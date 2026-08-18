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


// =====================================================
// CLEARANCE ELIGIBILITY
// =====================================================

router.get(
    "/student/:studentId/eligibility",
    getStudentClearanceEligibilityController
);


// =====================================================
// CLEARANCE APPROVAL
// =====================================================

router.put(
    "/:id/approve",
    approveClearanceRecord
);


// =====================================================
// CLEARANCE CRUD
// =====================================================

router.get(
    "/",
    getClearanceRecords
);

router.post(
    "/",
    createClearanceRecord
);

router.get(
    "/:id",
    getClearanceRecordById
);

router.put(
    "/:id",
    updateClearanceRecord
);

router.delete(
    "/:id",
    deleteClearanceRecord
);


module.exports = router;