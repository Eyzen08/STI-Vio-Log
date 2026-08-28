const express = require("express");
const rateLimit = require("express-rate-limit");

const { loginUser } = require("../controllers/authController");
const { link, login } = require("../controllers/googleAuthController");
const { register: registerDepartment, login: loginDepartment } = require('../controllers/googleDepartmentAuthController');

const router = express.Router();

router.post("/login", loginUser);

const googleAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many Google authentication attempts, please try again later", error: { code: "RATE_LIMITED", message: "Too many Google authentication attempts, please try again later" } }
});

router.post("/auth/google/link", googleAuthLimiter, link);
router.post("/auth/google/login", googleAuthLimiter, login);
router.post('/auth/google/department/register', googleAuthLimiter, registerDepartment);
router.post('/auth/google/department/login', googleAuthLimiter, loginDepartment);

module.exports = router;
