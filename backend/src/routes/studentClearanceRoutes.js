const express = require("express");

const {
    getMyClearanceRecords
} = require("../controllers/clearanceController");

const router = express.Router();


// =====================================================
// MY CLEARANCE
// =====================================================

router.get(
    "/",
    getMyClearanceRecords
);


module.exports = router;