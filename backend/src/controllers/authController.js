const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../config/database");

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

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const jwtSecret = getJwtSecret();
        const result = await pool.query(
            `SELECT * FROM users WHERE username = $1 AND is_active = TRUE`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            jwtSecret,
            { expiresIn: "8h" }
        );

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        if (error && error.message && error.message.toLowerCase().includes("jwt_secret")) {
            return res.status(500).json({
                success: false,
                message: "JWT_SECRET is not configured securely. Set a strong environment secret before launch."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

module.exports = {
    loginUser
};
