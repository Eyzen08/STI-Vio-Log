const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { permissionsForRole } = require('../security/permissions');
const { recordSecurityEvent } = require('../services/securityEventService');
const { notifyDisciplineSupportUse } = require('../services/notificationService');

const denyAuthorization = (req, res, { code = 'FORBIDDEN', message = 'Permission denied', required = [] } = {}) => {
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
        requestId:req.requestId,
        supportAccessRequestId:req.user.support_access_request_id
    }).then(send);
};


// =====================================================
// GET JWT SECRET
// =====================================================

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    const insecureDefaults = [
        "sti-vio-log-dev-secret-change-me",
        "change-this-to-a-long-random-secret"
    ];

    if (
        !secret ||
        insecureDefaults.includes(secret) ||
        secret.length < 32
    ) {
        const error = new Error(
            "JWT_SECRET is not configured securely. Set a strong environment secret before launch."
        );

        error.statusCode = 500;

        throw error;
    }

    return secret;
};


// =====================================================
// AUTHENTICATE TOKEN
// =====================================================

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access token required"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(
            token,
            getJwtSecret()
        );
    } catch (error) {
        console.error("[AUTH] Token verification failed:", error.message);

        if (error.message && error.message.toLowerCase().includes("jwt_secret")) {
            return res.status(500).json({
                success: false,
                message: "JWT_SECRET is not configured securely. Set a strong environment secret before launch."
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
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
                COALESCE(dh.department_id, sp.department_id) AS department_id
                ,CASE WHEN u.role='SYSTEM_ADMIN' THEN COALESCE((
                    SELECT jsonb_agg(DISTINCT scope)
                    FROM support_access_requests sar, unnest(sar.approved_scopes) scope
                    WHERE sar.requester_user_id=u.id AND sar.status='APPROVED'
                      AND sar.read_only=TRUE AND sar.revoked_at IS NULL AND sar.expires_at>CURRENT_TIMESTAMP
                ), '[]'::jsonb) ELSE '[]'::jsonb END AS support_scopes
                ,CASE WHEN u.role='SYSTEM_ADMIN' THEN (
                    SELECT sar.id FROM support_access_requests sar
                    WHERE sar.requester_user_id=u.id AND sar.status='APPROVED'
                      AND sar.read_only=TRUE AND sar.revoked_at IS NULL AND sar.expires_at>CURRENT_TIMESTAMP
                    ORDER BY sar.expires_at ASC LIMIT 1
                ) ELSE NULL END AS support_access_request_id
            FROM users u
            LEFT JOIN department_heads dh
                ON dh.user_id = u.id
            LEFT JOIN staff_profiles sp
                ON sp.user_id = u.id
            WHERE u.id = $1
              AND u.is_active = TRUE
            LIMIT 1
            `,
            [decoded.id]
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

        if (!Number.isInteger(decoded.session_version) || Number(decoded.session_version) !== Number(account.session_version)) {
            return res.status(401).json({ success: false, message: "Session has been invalidated", error: { code: "SESSION_INVALIDATED", message: "Session has been invalidated" } });
        }

        req.user = {
            id: Number(account.id),
            username: account.username,
            role: account.role,
            session_version: Number(account.session_version),
            must_change_password: Boolean(account.must_change_password),
            department_id: account.department_id
                ? Number(account.department_id)
                : null
        };
        req.user.support_scopes = Array.isArray(account.support_scopes) ? account.support_scopes : [];
        req.user.support_access_request_id = account.support_access_request_id ? Number(account.support_access_request_id) : null;
        req.user.base_permissions = [...permissionsForRole(account.role)];
        req.user.permissions = [...new Set([...req.user.base_permissions, ...req.user.support_scopes])];

        return next();

    } catch (error) {
        console.error("Authenticated account lookup failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to validate authenticated account"
        });
    }
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
    const effectivePermissions = new Set(req.user.permissions || permissionsForRole(req.user.role));
    if (!requiredPermissions.length || !requiredPermissions.every((permission) => effectivePermissions.has(permission))) {
        return denyAuthorization(req,res,{required:requiredPermissions});
    }
    const basePermissions = new Set(req.user.base_permissions || permissionsForRole(req.user.role));
    const reliesOnSupportGrant = requiredPermissions.some((permission) => !basePermissions.has(permission));
    if (reliesOnSupportGrant && req.method !== 'GET' && req.method !== 'HEAD') {
        return denyAuthorization(req,res,{code:'SUPPORT_ACCESS_READ_ONLY',message:'Temporary support access is read-only',required:requiredPermissions});
    }
    if (reliesOnSupportGrant) {
        return Promise.all([recordSecurityEvent({
            actor:req.user,
            action:'SUPPORT_ACCESS_USED',
            targetType:'API_ROUTE',
            targetLabel:`${req.method} ${req.originalUrl || req.path || 'unknown'}`,
            details:{effective_support_scopes:requiredPermissions},
            reason:'Approved temporary support access',
            result:'SUCCESS',
            ipAddress:req.ip,
            userAgent:req.get?.('user-agent'),
            requestId:req.requestId,
            supportAccessRequestId:req.user.support_access_request_id
        }),notifyDisciplineSupportUse(pool,{requestId:req.user.support_access_request_id,module:req.originalUrl || req.path}).catch((error)=>{
          console.error('Support access notification failed:',error.message)
          return []
        })]).then(()=>next());
    }
    return next();
};

const authorizeAnyPermission = (...allowedPermissions) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success:false, message:'Authentication required' });
    if (req.user.must_change_password) return res.status(403).json({ success:false, message:'Password change required', error:{code:'PASSWORD_CHANGE_REQUIRED',message:'Password change required'} });
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
    authenticateToken,
    authorizeRoles,
    authorizePermissions,
    authorizeAnyPermission,
    requireAuthorizedDepartment
};
