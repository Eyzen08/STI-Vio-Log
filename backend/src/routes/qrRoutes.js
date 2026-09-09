const express = require("express");

const {
    scanQrCode,
    timeIn,
    timeOut
} = require("../controllers/qrController");

const router = express.Router();
const { requireAuthorizedDepartment, authorizePermissions } = require("../middleware/authMiddleware");
const { PERMISSIONS } = require('../security/permissions');

router.post("/scan", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), requireAuthorizedDepartment, scanQrCode);
router.post("/time-in", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), requireAuthorizedDepartment, timeIn);
router.post("/time-out", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), requireAuthorizedDepartment, timeOut);

module.exports = router;
