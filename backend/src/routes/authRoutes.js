const express = require("express");
const rateLimit = require("express-rate-limit");

const { loginUser } = require("../controllers/authController");
const { link, login } = require("../controllers/googleAuthController");
const { createStudentPasswordAuthController } = require('../controllers/studentPasswordAuthController');

const router = express.Router();

const sensitiveAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success:false, message:'Too many authentication attempts, please try again later', error:{ code:'RATE_LIMITED', message:'Too many authentication attempts, please try again later' } }
});

const studentAuth = createStudentPasswordAuthController();

router.post("/login", sensitiveAuthLimiter, loginUser);
router.post('/auth/student/register', sensitiveAuthLimiter, studentAuth.register);
router.post('/auth/student/registration/resend', sensitiveAuthLimiter, studentAuth.resendRegistrationOtp);
router.post('/auth/student/registration/verify', sensitiveAuthLimiter, studentAuth.verifyRegistration);
router.post('/auth/student/password/forgot', sensitiveAuthLimiter, studentAuth.requestPasswordReset);
router.post('/auth/student/password/verify', sensitiveAuthLimiter, studentAuth.verifyPasswordReset);
router.post('/auth/student/password/reset', sensitiveAuthLimiter, studentAuth.resetPassword);

const googleAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many Google authentication attempts, please try again later", error: { code: "RATE_LIMITED", message: "Too many Google authentication attempts, please try again later" } }
});

router.post("/auth/google/link", googleAuthLimiter, link);
router.post("/auth/google/login", googleAuthLimiter, login);

module.exports = router;
