const express = require('express');
const {
  getAuditLogs,
  getAuditLogStats
} = require('../controllers/auditController');

const router = express.Router();
const { authorizeAnyPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const canViewAudit = authorizeAnyPermission(PERMISSIONS.OPERATIONAL_AUDIT_VIEW, PERMISSIONS.TECHNICAL_AUDIT_VIEW);

// Get audit log records
router.get('/', canViewAudit, getAuditLogs);

// Get audit log statistics
router.get('/stats', canViewAudit, getAuditLogStats);

module.exports = router;
