const express = require("express");

const {
    scanQrCode,
    timeIn,
    timeOut
} = require("../controllers/qrController");

const router = express.Router();
const { authorizePermissions } = require("../middleware/authMiddleware");
const { PERMISSIONS } = require('../security/permissions');

router.post("/scan", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), scanQrCode);
router.post("/time-in", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), timeIn);
router.post("/time-out", authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN), timeOut);

module.exports = router;
