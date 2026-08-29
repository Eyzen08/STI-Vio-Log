const express = require("express");

const {
    getMyClearanceRecords,
    getMyClearanceEligibility
} = require("../controllers/clearanceController");

const router = express.Router();
const { getMyClearanceCertificate } = require('../controllers/clearanceCertificateController');


// =====================================================
// MY CLEARANCE ELIGIBILITY
// =====================================================
// STUDENT ONLY.
//
// The student ID is NOT provided by the client.
// The controller gets the authenticated user's ID
// from req.user.id and finds the corresponding
// students.id.
//
// GET /api/student/clearance/eligibility
// =====================================================

router.get(
    "/eligibility",
    getMyClearanceEligibility
);

router.get('/certificate', getMyClearanceCertificate);


// =====================================================
// MY CLEARANCE RECORDS
// =====================================================
// STUDENT ONLY.
//
// GET /api/student/clearance
// =====================================================

router.get(
    "/",
    getMyClearanceRecords
);


module.exports = router;
