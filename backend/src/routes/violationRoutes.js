const express = require("express");

const {
    getViolationTypes,
    getStudentViolationHistory,
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation,
    performViolationAction,
    getViolationActions
} = require("../controllers/violationController");

const router = express.Router();
const { authorizePermissions } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
const actionPermissions = Object.freeze({
    COMPLETE: PERMISSIONS.VIOLATION_COMPLETE,
    CLEAR: PERMISSIONS.VIOLATION_CLEAR,
    INVALID_CANCEL: PERMISSIONS.VIOLATION_INVALIDATE,
    REOPEN: PERMISSIONS.VIOLATION_REOPEN
});
const authorizeViolationAction = (req,res,next) => {
    const permission = actionPermissions[String(req.body?.action || '').trim().toUpperCase()];
    if (!permission) return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'Invalid violation action'}});
    return authorizePermissions(permission)(req,res,next);
};

router.get("/types", authorizePermissions(PERMISSIONS.STUDENT_BASIC_VIEW), getViolationTypes);
router.get("/student/:studentId", authorizePermissions(PERMISSIONS.STUDENT_RESTRICTED_VIEW), getStudentViolationHistory);
router.get("/", authorizePermissions(PERMISSIONS.STUDENT_RESTRICTED_VIEW), getViolations);
router.post("/", authorizePermissions(PERMISSIONS.VIOLATION_CREATE), createViolation);
router.get("/:id/actions", authorizePermissions(PERMISSIONS.STUDENT_RESTRICTED_VIEW), getViolationActions);
router.post("/:id/actions", authorizeViolationAction, performViolationAction);
router.get("/:id", authorizePermissions(PERMISSIONS.STUDENT_RESTRICTED_VIEW), getViolationById);
router.put("/:id", authorizePermissions(PERMISSIONS.VIOLATION_UPDATE), updateViolation);
router.delete("/:id", authorizePermissions(PERMISSIONS.VIOLATION_INVALIDATE), deleteViolation);

module.exports = router;
