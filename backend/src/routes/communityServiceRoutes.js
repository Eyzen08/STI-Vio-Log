const express = require("express");

const {
    getCommunityServiceAssignments,
    getCommunityServiceAssignmentById,
    getMyCommunityServiceAssignment,
    createCommunityServiceAssignment,
    updateCommunityServiceAssignment,
    deleteCommunityServiceAssignment
} = require("../controllers/communityServiceController");

const {
    communityServiceTimeIn,
    communityServiceTimeOut,
    getCommunityServiceAttendance,
    getCommunityServiceSessions
} = require("../controllers/communityServiceAttendanceController");

const {
    authorizeRoles,
    requireAuthorizedDepartment
} = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// STUDENT - OWN COMMUNITY SERVICE
// =====================================================
// Students can only view their own community-service
// assignments through the controller using req.user.id.
// =====================================================

router.get(
    "/my-assignment",
    authorizeRoles("STUDENT"),
    getMyCommunityServiceAssignment
);


// =====================================================
// COMMUNITY SERVICE ATTENDANCE
// =====================================================
// Only authorized staff can record/view attendance.
// =====================================================

router.post(
    "/attendance/time-in",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE",
        "DEPARTMENT_HEAD"
    ),
    requireAuthorizedDepartment,
    communityServiceTimeIn
);


router.post(
    "/attendance/time-out",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE",
        "DEPARTMENT_HEAD"
    ),
    requireAuthorizedDepartment,
    communityServiceTimeOut
);


router.get(
    "/:assignmentId/sessions",
    authorizeRoles("ADMIN", "DISCIPLINE_OFFICE", "DEPARTMENT_HEAD"),
    getCommunityServiceSessions
);

router.get(
    "/attendance/:assignmentId",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE",
        "DEPARTMENT_HEAD"
    ),
    getCommunityServiceAttendance
);


// =====================================================
// COMMUNITY SERVICE ASSIGNMENTS
// =====================================================
// Management access:
// - ADMIN
// - DISCIPLINE_OFFICE
// - DEPARTMENT_HEAD
// =====================================================

router.get(
    "/",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE",
        "DEPARTMENT_HEAD"
    ),
    getCommunityServiceAssignments
);


router.post(
    "/",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE"
    ),
    createCommunityServiceAssignment
);


router.get(
    "/:id",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE",
        "DEPARTMENT_HEAD"
    ),
    getCommunityServiceAssignmentById
);


router.put(
    "/:id",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE"
    ),
    updateCommunityServiceAssignment
);


router.delete(
    "/:id",
    authorizeRoles(
        "ADMIN",
        "DISCIPLINE_OFFICE"
    ),
    deleteCommunityServiceAssignment
);


module.exports = router;
