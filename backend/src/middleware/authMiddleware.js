const pool = require("../config/database");
const sessionService = require('../services/browserSessionService');
const { permissionsForRole } = require('../security/permissions');
const { recordSecurityEvent } = require('../services/securityEventService');

const denyAuthorization = (req, res, { code = 'FORBIDDEN', message = 'Permission denied', required = [] } = {}) => {
    res.locals = res.locals || {};
    res.locals.authorizationDenied = true;
    const send = () => res.status(403).json({ success:false, message, error:{code,message} });
    if (!req.user?.id) return send();
    return recordSecurityEvent({
        actor:req.user,
        action:'AUTHORIZATION_DENIED',
        targetType:'API_ROUTE',
        targetLabel:`${req.method || 'UNKNOWN'} ${req.originalUrl || req.path || 'unknown'}`,
        details:{required_permissions:required},
        result:'DENIED',
        ipAddress:req.ip,
        userAgent:req.get?.('user-agent'),
        requestId:req.requestId
    }).then(send);
};


// =====================================================
// AUTHENTICATE OPAQUE COOKIE SESSION
// =====================================================

const authenticateToken = async (req, res, next) => {
    const token = sessionService.parseCookies(req.headers.cookie)[sessionService.COOKIE_NAME];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authenticated session required"
        });
    }

    try {
        const accountResult = await pool.query(
            `
            SELECT
                u.id,
                u.username,
                u.role,
                u.email_verified,
                u.session_version,
                u.must_change_password,
                s.onboarding_required,
                s.onboarding_completed_at,
                s.pending_google_email,
                s.pending_google_email_verified_at,
                EXISTS(SELECT 1 FROM google_identity_links gil WHERE gil.user_id=u.id AND gil.revoked_at IS NULL) AS google_linked,
                COALESCE(s.first_name,dh.first_name,sp.first_name,ap.first_name) AS first_name,
                COALESCE(s.last_name,dh.last_name,sp.last_name,ap.last_name) AS last_name,
                bs.id AS browser_session_id,
                bs.csrf_hash,
                bs.absolute_expires_at,
                COALESCE(dh.department_id, sp.department_id) AS department_id
            FROM browser_sessions bs
            JOIN users u ON u.id=bs.user_id
            LEFT JOIN department_heads dh
                ON dh.user_id = u.id
            LEFT JOIN staff_profiles sp
                ON sp.user_id = u.id
            LEFT JOIN students s ON s.user_id=u.id
            LEFT JOIN admin_profiles ap ON ap.user_id=u.id
            WHERE bs.token_hash = $1 AND bs.revoked_at IS NULL
              AND bs.idle_expires_at>CURRENT_TIMESTAMP AND bs.absolute_expires_at>CURRENT_TIMESTAMP
              AND u.is_active = TRUE
            LIMIT 1
            `,
            [sessionService.hash(token)]
        );

        if (accountResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid or inactive account"
            });
        }

        const account = accountResult.rows[0];

        if (account.role === 'STUDENT' && !account.email_verified) {
            return res.status(401).json({ success:false, message:'Student email verification is required' });
        }

        req.user = {
            id: Number(account.id),
            username: account.username,
            role: account.role,
            session_version: Number(account.session_version),
            must_change_password: Boolean(account.must_change_password),
            onboarding_required: Boolean(account.onboarding_required) && !account.onboarding_completed_at,
            onboarding_completed_at: account.onboarding_completed_at || null,
            google_linked: Boolean(account.google_linked),
            pending_google_email: account.pending_google_email || null,
            pending_google_email_verified_at: account.pending_google_email_verified_at || null,
            department_id: account.department_id
                ? Number(account.department_id)
                : null,
            first_name:account.first_name||null,
            last_name:account.last_name||null
        };
        req.user.base_permissions = [...permissionsForRole(account.role)];
        req.user.permissions = req.user.base_permissions;

        const idleMinutes=account.role==='DISCIPLINE_ADMIN'?30:120;
        await pool.query(`UPDATE browser_sessions SET last_seen_at=CURRENT_TIMESTAMP,
          idle_expires_at=LEAST(absolute_expires_at,CURRENT_TIMESTAMP+($2||' minutes')::interval) WHERE id=$1`,[account.browser_session_id,idleMinutes]);
        req.session={id:Number(account.browser_session_id),csrfHash:account.csrf_hash,absoluteExpiresAt:account.absolute_expires_at};

        return requireCsrf(req,res,next);

    } catch (error) {
        console.error("Authenticated account lookup failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to validate authenticated account"
        });
    }
};

const requireCsrf = (req,res,next) => {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    if (!req.session) return res.status(401).json({success:false,message:'Authentication required'});
    const cookies=sessionService.parseCookies(req.headers.cookie);
    const cookieToken=cookies[sessionService.CSRF_COOKIE];
    const headerToken=req.get('x-csrf-token');
    if (!cookieToken || !headerToken || cookieToken!==headerToken || sessionService.hash(headerToken,process.env.CSRF_SIGNING_KEY)!==req.session.csrfHash) {
      return res.status(403).json({success:false,message:'CSRF validation failed',error:{code:'CSRF_INVALID',message:'CSRF validation failed'}});
    }
    return next();
};


// =====================================================
// AUTHORIZE ROLES
// =====================================================

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (req.user.must_change_password) {
        return res.status(403).json({ success: false, message: "Password change required", error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" } });
    }

    if (req.user.role === 'STUDENT' && req.user.onboarding_required) {
        return res.status(403).json({ success:false, message:'Complete student account onboarding', error:{code:'STUDENT_ONBOARDING_REQUIRED',message:'Complete student account onboarding'} });
    }

    if (!allowedRoles.includes(req.user.role)) {
        return denyAuthorization(req,res,{required:allowedRoles.map((role)=>`ROLE:${role}`)});
    }

    return next();
};

const authorizePermissions = (...requiredPermissions) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.must_change_password) {
        return res.status(403).json({ success: false, message: 'Password change required', error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change required' } });
    }
    if (req.user.role === 'STUDENT' && req.user.onboarding_required) return res.status(403).json({success:false,message:'Complete student account onboarding',error:{code:'STUDENT_ONBOARDING_REQUIRED',message:'Complete student account onboarding'}});
    const effectivePermissions = new Set(req.user.permissions || permissionsForRole(req.user.role));
    if (!requiredPermissions.length || !requiredPermissions.every((permission) => effectivePermissions.has(permission))) {
        return denyAuthorization(req,res,{required:requiredPermissions});
    }
    return next();
};

const authorizeAnyPermission = (...allowedPermissions) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success:false, message:'Authentication required' });
    if (req.user.must_change_password) return res.status(403).json({ success:false, message:'Password change required', error:{code:'PASSWORD_CHANGE_REQUIRED',message:'Password change required'} });
    if (req.user.role === 'STUDENT' && req.user.onboarding_required) return res.status(403).json({success:false,message:'Complete student account onboarding',error:{code:'STUDENT_ONBOARDING_REQUIRED',message:'Complete student account onboarding'}});
    const effectivePermissions = new Set(req.user.permissions || permissionsForRole(req.user.role));
    if (!allowedPermissions.length || !allowedPermissions.some((permission) => effectivePermissions.has(permission))) {
        return denyAuthorization(req,res,{required:allowedPermissions});
    }
    return next();
};

const requireAuthorizedDepartment = async (req, res, next) => {
    const scopedOfficer = ["DEPARTMENT_HEAD", "DISCIPLINE_OFFICE"].includes(req.user.role) && req.user.department_id;
    const departmentId = scopedOfficer
        ? req.user.department_id
        : req.body.department_id;

    if (!departmentId) {
        return res.status(400).json({
            success: false,
            message: "A valid staff department is required"
        });
    }

    try {
        const result = scopedOfficer
            ? await pool.query(
                `SELECT d.id FROM officer_department_assignments oda
                 JOIN departments d ON d.id=oda.department_id
                 LEFT JOIN department_heads dh ON dh.user_id=oda.officer_user_id
                 WHERE oda.officer_user_id=$1 AND oda.department_id=$2 AND oda.status='ACTIVE'
                   AND oda.starts_at<=CURRENT_TIMESTAMP AND (oda.ends_at IS NULL OR oda.ends_at>CURRENT_TIMESTAMP)
                   AND d.is_active=TRUE AND ($3::text<>'DEPARTMENT_HEAD' OR COALESCE(dh.qr_scanner_enabled,FALSE)=TRUE)`,
                [req.user.id, departmentId, req.user.role]
            )
            : await pool.query(
                "SELECT id FROM departments WHERE id = $1 AND is_active = TRUE",
                [departmentId]
            );

        if (result.rows.length === 0) {
            return res.status(scopedOfficer ? 403 : 400).json({
                success: false,
                message: scopedOfficer
                    ? "QR scanner access is not enabled for this account"
                    : "A valid staff department is required"
            });
        }

        req.staffDepartmentId = Number(departmentId);
        return next();
    } catch (error) {
        console.error("Department authorization error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to validate staff department"
        });
    }
};


module.exports = {
    denyAuthorization,
    authenticateToken,
    authorizeRoles,
    authorizePermissions,
    authorizeAnyPermission,
    requireCsrf,
    requireAuthorizedDepartment
};
