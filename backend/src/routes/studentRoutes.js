const express = require("express");

const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getMyProfile,
    getMyViolations
} = require("../controllers/studentController");

const { getMyCommunityServiceAssignment } = require("../controllers/communityServiceController");
const { getMyClearanceRecords } = require("../controllers/clearanceController");
const { getMyDTR } = require("../controllers/communityServiceSessionReportController");
const { getMyNotifications, markMyNotificationRead } = require("../controllers/notificationController");
const { authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// LOGGED-IN STUDENT'S OWN DATA
// =====================================================

router.get("/me", authorizeRoles("STUDENT"), getMyProfile);

router.get(
    "/me/violations",
    authorizeRoles("STUDENT"),
    getMyViolations
);

router.get("/me/community-service", authorizeRoles("STUDENT"), getMyCommunityServiceAssignment);
router.get("/me/community-service/dtr", authorizeRoles("STUDENT"), getMyDTR);
router.get("/me/clearance", authorizeRoles("STUDENT"), getMyClearanceRecords);
router.get("/me/notifications", authorizeRoles("STUDENT"), getMyNotifications);
router.patch("/me/notifications/:id/read", authorizeRoles("STUDENT"), markMyNotificationRead);


// =====================================================
// STUDENT CRUD
// =====================================================

router.get(
    "/",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    getStudents
);

router.post(
    "/",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    createStudent
);

router.get(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    getStudentById
);

router.put(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    updateStudent
);

router.delete(
    "/:id",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
    deleteStudent
);


module.exports = router;
