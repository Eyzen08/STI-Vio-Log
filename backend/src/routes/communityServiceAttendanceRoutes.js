const express = require("express");

const {
    communityServiceTimeIn,
    communityServiceTimeOut,
    getCommunityServiceAttendance
} = require("../controllers/communityServiceAttendanceController");

const router = express.Router();

// Community service attendance
router.post("/time-in", communityServiceTimeIn);
router.post("/time-out", communityServiceTimeOut);
router.get("/:assignmentId", getCommunityServiceAttendance);

module.exports = router;