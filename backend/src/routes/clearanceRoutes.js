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
