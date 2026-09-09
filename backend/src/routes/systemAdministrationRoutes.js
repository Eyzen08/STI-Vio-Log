const express = require('express');
const rateLimit = require('express-rate-limit');
const { authorizePermissions } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const controller = require('../controllers/systemAdministrationController');

const router = express.Router();
const sensitiveActionLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many sensitive account actions; try again later'}}});
router.get('/status', authorizePermissions(PERMISSIONS.SYSTEM_HEALTH_VIEW, PERMISSIONS.SYSTEM_VERSION_VIEW), controller.status);
router.get('/security-events', authorizePermissions(PERMISSIONS.SECURITY_EVENTS_VIEW), controller.securityEvents);
router.get('/authentication-activity', authorizePermissions(PERMISSIONS.AUTH_ACTIVITY_VIEW), controller.authenticationActivity);
router.patch('/accounts/:id/lock', sensitiveActionLimiter, authorizePermissions(PERMISSIONS.ACCOUNT_LOCK), controller.accountLock);
router.post('/accounts/:id/recovery', sensitiveActionLimiter, authorizePermissions(PERMISSIONS.ACCOUNT_RECOVERY_INITIATE), controller.accountRecovery);
router.get('/security-events', authorizePermissions(PERMISSIONS.SECURITY_EVENTS_VIEW), controller.securityEvents);
router.get('/authentication-activity', authorizePermissions(PERMISSIONS.AUTH_ACTIVITY_VIEW), controller.authenticationActivity);

module.exports = router;
