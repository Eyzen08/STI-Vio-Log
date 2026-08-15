const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getViolationReport,
  getCommunityServiceReport,
  getDTRReport,
  getNonComplianceReport
} = require('../controllers/reportController');

const router = express.Router();

// All reports require authentication and ADMIN/DISCIPLINE_OFFICE role
router.get('/violations', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getViolationReport);
router.get('/community-service', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getCommunityServiceReport);
router.get('/dtr', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD'), getDTRReport);
router.get('/non-compliance', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getNonComplianceReport);

module.exports = router;
