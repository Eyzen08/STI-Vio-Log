const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getViolationReport,
  getCommunityServiceReport,
  getNonComplianceReport
} = require('../controllers/reportController');
const { getDTRReport } = require('../controllers/communityServiceSessionReportController');
const { getParentContactReport, getClearanceReport, getGoodStandingReport } = require('../controllers/extendedReportController');

const router = express.Router();

// All reports require authentication and ADMIN/DISCIPLINE_OFFICE role
router.get('/violations', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getViolationReport);
router.get('/community-service', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getCommunityServiceReport);
router.get('/dtr', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getDTRReport);
router.get('/non-compliance', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getNonComplianceReport);
router.get('/parent-contacts', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getParentContactReport);
router.get('/clearance', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getClearanceReport);
router.get('/good-standing', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), getGoodStandingReport);

module.exports = router;
