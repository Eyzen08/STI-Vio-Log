const express = require('express');
const { authenticateToken, authorizePermissions, authorizeAnyPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const { auditAdministrativeRequest } = require('../middleware/administrativeAuditMiddleware');
const {
  exportAnalytics,
  getViolationReport,
  exportViolationReportCsv,
  exportViolationReportXlsx,
  getCommunityServiceReport,
  getNonComplianceReport
} = require('../controllers/reportController');
const { getDTRReport } = require('../controllers/communityServiceSessionReportController');
const { getParentContactReport, getClearanceReport, getGoodStandingReport } = require('../controllers/extendedReportController');
const { exportReport } = require('../controllers/reportExportController');

const router = express.Router();

const canViewReport = authorizePermissions(PERMISSIONS.REPORT_VIEW);
const canViewDepartmentReport = authorizeAnyPermission(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DEPARTMENT_REPORT_VIEW);
router.post('/analytics.xlsx', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DATA_EXPORT), exportAnalytics);
router.post('/analytics.csv', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DATA_EXPORT), exportAnalytics);
router.get('/violations.csv', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DATA_EXPORT), exportViolationReportCsv);
router.get('/violations.xlsx', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.DATA_EXPORT), exportViolationReportXlsx);
for (const type of ['community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
  const view = ['dtr','non-compliance'].includes(type) ? canViewDepartmentReport : canViewReport;
  const exportPermissions = type==='parent-contacts' ? authorizePermissions(PERMISSIONS.DATA_EXPORT,PERMISSIONS.GUARDIAN_CONTACT_VIEW) : authorizePermissions(PERMISSIONS.DATA_EXPORT);
  router.get(`/${type}.xlsx`,authenticateToken,auditAdministrativeRequest,view,exportPermissions,exportReport(type));
}
router.get('/violations', authenticateToken, canViewReport, getViolationReport);
router.get('/community-service', authenticateToken, canViewReport, getCommunityServiceReport);
router.get('/dtr', authenticateToken, canViewDepartmentReport, getDTRReport);
router.get('/non-compliance', authenticateToken, canViewDepartmentReport, getNonComplianceReport);
router.get('/parent-contacts', authenticateToken, authorizePermissions(PERMISSIONS.REPORT_VIEW, PERMISSIONS.GUARDIAN_CONTACT_VIEW), getParentContactReport);
router.get('/clearance', authenticateToken, canViewReport, getClearanceReport);
router.get('/good-standing', authenticateToken, canViewReport, getGoodStandingReport);

module.exports = router;
