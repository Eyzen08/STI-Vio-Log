const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    const insecureDefaults = [
        "sti-vio-log-dev-secret-change-me",
        "change-this-to-a-long-random-secret"
    ];

    if (!secret || insecureDefaults.includes(secret) || secret.length < 32) {
        const error = new Error("JWT_SECRET is not configured securely. Set a strong environment secret before launch.");
        error.statusCode = 500;
        throw error;
    }

    return secret;
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access token required"
        });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded;
        return next();
    } catch (error) {
        if (error && error.message && error.message.toLowerCase().includes("jwt_secret")) {
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
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to access this resource"
        });
    }

    return next();
};

module.exports = {
    authenticateToken,
    authorizeRoles
};
