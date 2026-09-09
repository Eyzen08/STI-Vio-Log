const express = require('express');
const { authenticateToken, authorizePermissions } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const { auditAdministrativeRequest } = require('../middleware/administrativeAuditMiddleware');
const {
  getViolationReport,
  exportViolationReportCsv,
  getCommunityServiceReport,
  getNonComplianceReport
} = require('../controllers/reportController');
const { getDTRReport } = require('../controllers/communityServiceSessionReportController');
const { getParentContactReport, getClearanceReport, getGoodStandingReport } = require('../controllers/extendedReportController');

const router = express.Router();

const canViewReport = authorizePermissions(PERMISSIONS.REPORT_VIEW);
router.get('/violations.csv', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DATA_EXPORT), exportViolationReportCsv);
router.get('/violations', authenticateToken, canViewReport, getViolationReport);
router.get('/community-service', authenticateToken, canViewReport, getCommunityServiceReport);
router.get('/dtr', authenticateToken, canViewReport, getDTRReport);
router.get('/non-compliance', authenticateToken, canViewReport, getNonComplianceReport);
router.get('/parent-contacts', authenticateToken, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.GUARDIAN_CONTACT_VIEW), getParentContactReport);
router.get('/clearance', authenticateToken, canViewReport, getClearanceReport);
router.get('/good-standing', authenticateToken, canViewReport, getGoodStandingReport);

module.exports = router;
