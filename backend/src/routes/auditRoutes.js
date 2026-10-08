const express = require('express');
const {
  getAuditLogs,
  getAuditLogStats,
  exportAuditLogs
} = require('../controllers/auditController');

const router = express.Router();
const { authorizeAnyPermission, authorizePermissions } = require('../middleware/authMiddleware');
const { auditAdministrativeRequest } = require('../middleware/administrativeAuditMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const canViewAudit = authorizeAnyPermission(PERMISSIONS.OPERATIONAL_AUDIT_VIEW, PERMISSIONS.TECHNICAL_AUDIT_VIEW);

// Get audit log records
router.get('/', canViewAudit, getAuditLogs);

// Get audit log statistics
router.get('/stats', canViewAudit, getAuditLogStats);
router.get('/export.xlsx', auditAdministrativeRequest, canViewAudit, authorizePermissions(PERMISSIONS.DATA_EXPORT), exportAuditLogs);

module.exports = router;
