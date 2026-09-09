const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/supportAccessController');
const { authorizePermissions, authorizeAnyPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders:true, legacyHeaders:false });

router.get('/', authorizeAnyPermission(PERMISSIONS.SUPPORT_ACCESS_HISTORY_VIEW, PERMISSIONS.SUPPORT_ACCESS_APPROVE), controller.list);
router.post('/', limiter, authorizePermissions(PERMISSIONS.SUPPORT_ACCESS_REQUEST), controller.request);
router.patch('/:id/decision', limiter, authorizePermissions(PERMISSIONS.SUPPORT_ACCESS_APPROVE), controller.decide);
router.patch('/:id/revoke', limiter, authorizeAnyPermission(PERMISSIONS.SUPPORT_ACCESS_REQUEST, PERMISSIONS.SUPPORT_ACCESS_APPROVE), controller.revoke);
module.exports = router;
