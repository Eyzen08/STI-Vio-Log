const express = require("express");

const {
    scanQrCode,
    timeIn,
    timeOut
} = require("../controllers/qrController");

const router = express.Router();
const { requireAuthorizedDepartment } = require("../middleware/authMiddleware");

router.post("/scan", requireAuthorizedDepartment, scanQrCode);
router.post("/time-in", requireAuthorizedDepartment, timeIn);
router.post("/time-out", requireAuthorizedDepartment, timeOut);

module.exports = router;
