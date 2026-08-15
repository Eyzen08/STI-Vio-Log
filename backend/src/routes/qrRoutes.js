const express = require("express");

const {
    scanQrCode,
    timeIn,
    timeOut
} = require("../controllers/qrController");

const router = express.Router();

router.post("/scan", scanQrCode);
router.post("/time-in", timeIn);
router.post("/time-out", timeOut);

module.exports = router;
