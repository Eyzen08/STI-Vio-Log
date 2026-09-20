const express = require('express');
const { authorizePermissions } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const controller = require('../controllers/systemAdministrationController');

const router = express.Router();
router.get('/status', authorizePermissions(PERMISSIONS.SYSTEM_HEALTH_VIEW, PERMISSIONS.SYSTEM_VERSION_VIEW), controller.status);
router.get('/accounts', authorizePermissions(PERMISSIONS.ACCOUNT_LOCK), controller.accountDirectory);
router.get('/security-events', authorizePermissions(PERMISSIONS.SECURITY_EVENTS_VIEW), controller.securityEvents);
router.get('/authentication-activity', authorizePermissions(PERMISSIONS.AUTH_ACTIVITY_VIEW), controller.authenticationActivity);
module.exports = router;
