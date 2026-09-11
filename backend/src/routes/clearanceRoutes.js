const express = require("express");

const {
    getClearanceRecords,
    getClearanceRecordById,
    getStudentClearanceEligibilityController,
    createClearanceRecord,
    updateClearanceRecord,
    deleteClearanceRecord,
    approveClearanceRecord
} = require("../controllers/clearanceController");

const router = express.Router();
const { authorizePermissions } = require("../middleware/authMiddleware");
const { PERMISSIONS } = require('../security/permissions');
const certificate = require('../controllers/clearanceCertificateController');

router.get('/certificates/eligible', authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW), certificate.getEligibleStudents);
router.get('/certificates/students', authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW), certificate.getCertificateStudentDirectory);
router.post('/certificates/students/:studentId/approve', authorizePermissions(PERMISSIONS.CLEARANCE_APPROVE), certificate.approveCertificateStudent);
router.get('/certificates', authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW), certificate.listCertificates);
router.post('/certificates', authorizePermissions(PERMISSIONS.CLEARANCE_CERTIFICATE_ISSUE), certificate.issueCertificate);
router.get('/certificates/:id/pdf', authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW), certificate.downloadCertificate);
router.post('/certificates/:id/revoke', authorizePermissions(PERMISSIONS.CLEARANCE_CERTIFICATE_ISSUE), certificate.revokeCertificate);
router.post('/certificates/:id/email', authorizePermissions(PERMISSIONS.CLEARANCE_CERTIFICATE_ISSUE), certificate.resendCertificate);
router.get('/signatures', authorizePermissions(PERMISSIONS.ESIGNATURE_MANAGE), certificate.listSignatures);
router.post('/signatures', authorizePermissions(PERMISSIONS.ESIGNATURE_MANAGE), certificate.saveSignature);
router.put('/signatures/:id', authorizePermissions(PERMISSIONS.ESIGNATURE_MANAGE), certificate.updateSignature);


// =====================================================
// CLEARANCE ELIGIBILITY
// =====================================================

router.get(
    "/student/:studentId/eligibility",
    authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW),
    getStudentClearanceEligibilityController
);


// =====================================================
// CLEARANCE APPROVAL
// =====================================================

router.put(
    "/:id/approve",
    authorizePermissions(PERMISSIONS.CLEARANCE_APPROVE),
    approveClearanceRecord
);


// =====================================================
// CLEARANCE CRUD
// =====================================================

router.get(
    "/",
    authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW),
    getClearanceRecords
);

router.post(
    "/",
    authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW),
    createClearanceRecord
);

router.get(
    "/:id",
    authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW),
    getClearanceRecordById
);

router.put(
    "/:id",
    authorizePermissions(PERMISSIONS.CLEARANCE_REVIEW),
    updateClearanceRecord
);

router.delete(
    "/:id",
    authorizePermissions(PERMISSIONS.CLEARANCE_APPROVE),
    deleteClearanceRecord
);


module.exports = router;
