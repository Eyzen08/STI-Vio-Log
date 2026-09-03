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
const { authorizeRoles } = require("../middleware/authMiddleware");
const certificate = require('../controllers/clearanceCertificateController');

router.get('/certificates/eligible', certificate.getEligibleStudents);
router.get('/certificates', certificate.listCertificates);
router.post('/certificates', certificate.issueCertificate);
router.get('/certificates/:id/pdf', certificate.downloadCertificate);
router.post('/certificates/:id/revoke', certificate.revokeCertificate);
router.post('/certificates/:id/email', certificate.resendCertificate);
router.get('/signatures', certificate.listSignatures);
router.post('/signatures', certificate.saveSignature);
router.put('/signatures/:id', certificate.updateSignature);


// =====================================================
// CLEARANCE ELIGIBILITY
// =====================================================

router.get(
    "/student/:studentId/eligibility",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    getStudentClearanceEligibilityController
);


// =====================================================
// CLEARANCE APPROVAL
// =====================================================

router.put(
    "/:id/approve",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    approveClearanceRecord
);


// =====================================================
// CLEARANCE CRUD
// =====================================================

router.get(
    "/",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    getClearanceRecords
);

router.post(
    "/",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    createClearanceRecord
);

router.get(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    getClearanceRecordById
);

router.put(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    updateClearanceRecord
);

router.delete(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    deleteClearanceRecord
);


module.exports = router;
