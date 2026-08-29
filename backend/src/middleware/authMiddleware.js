const jwt = require("jsonwebtoken");
const pool = require("../config/database");


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
                u.session_version,
                u.must_change_password,
                dh.department_id
            FROM users u
            LEFT JOIN department_heads dh
                ON dh.user_id = u.id
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
        return res.status(403).json({
            success: false,
            message: "You do not have permission to access this resource"
        });
    }

    return next();
};

const requireAuthorizedDepartment = async (req, res, next) => {
    const departmentId = req.user.role === "DEPARTMENT_HEAD"
        ? req.user.department_id
        : req.body.department_id;

    if (!departmentId) {
        return res.status(400).json({
            success: false,
            message: "A valid staff department is required"
        });
    }

    try {
        const result = req.user.role === "DEPARTMENT_HEAD"
            ? await pool.query(
                `SELECT d.id FROM department_heads dh
                 JOIN departments d ON d.id = dh.department_id
                 WHERE dh.user_id = $1 AND dh.department_id = $2
                   AND dh.qr_scanner_enabled = TRUE AND d.is_active = TRUE`,
                [req.user.id, departmentId]
            )
            : await pool.query(
                "SELECT id FROM departments WHERE id = $1 AND is_active = TRUE",
                [departmentId]
            );

        if (result.rows.length === 0) {
            return res.status(req.user.role === "DEPARTMENT_HEAD" ? 403 : 400).json({
                success: false,
                message: req.user.role === "DEPARTMENT_HEAD"
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
    requireAuthorizedDepartment
};
