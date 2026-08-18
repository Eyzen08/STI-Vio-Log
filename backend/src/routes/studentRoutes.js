const express = require("express");

const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getMyViolations
} = require("../controllers/studentController");

const router = express.Router();


// =====================================================
// LOGGED-IN STUDENT'S OWN DATA
// =====================================================

router.get(
    "/me/violations",
    getMyViolations
);


// =====================================================
// STUDENT CRUD
// =====================================================

router.get(
    "/",
    getStudents
);

router.post(
    "/",
    createStudent
);

router.get(
    "/:id",
    getStudentById
);

router.put(
    "/:id",
    updateStudent
);

router.delete(
    "/:id",
    deleteStudent
);


module.exports = router;