const express = require("express");

const {
    getCommunityServiceAssignments,
    getCommunityServiceAssignmentById,
    createCommunityServiceAssignment,
    updateCommunityServiceAssignment,
    deleteCommunityServiceAssignment
} = require("../controllers/communityServiceController");

const {
    communityServiceTimeIn,
    communityServiceTimeOut,
    getCommunityServiceAttendance
} = require("../controllers/communityServiceAttendanceController");

const router = express.Router();


// =====================================================
// COMMUNITY SERVICE ATTENDANCE
// =====================================================

router.post(
    "/attendance/time-in",
    communityServiceTimeIn
);

router.post(
    "/attendance/time-out",
    communityServiceTimeOut
);

router.get(
    "/attendance/:assignmentId",
    getCommunityServiceAttendance
);


// =====================================================
// COMMUNITY SERVICE ASSIGNMENTS
// =====================================================

router.get("/", getCommunityServiceAssignments);

router.post("/", createCommunityServiceAssignment);

router.get("/:id", getCommunityServiceAssignmentById);

router.put("/:id", updateCommunityServiceAssignment);

router.delete("/:id", deleteCommunityServiceAssignment);


module.exports = router;