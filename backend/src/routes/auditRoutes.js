const express = require('express');
const {
  getAuditLogs,
  getAuditLogStats
} = require('../controllers/auditController');

const router = express.Router();

// Get audit log records
router.get('/', getAuditLogs);

// Get audit log statistics
router.get('/stats', getAuditLogStats);

module.exports = router;
