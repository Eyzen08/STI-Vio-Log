const express = require("express");

const {
    getClearanceRecords,
    getClearanceRecordById,
    createClearanceRecord,
    updateClearanceRecord,
    deleteClearanceRecord
} = require("../controllers/clearanceController");

const router = express.Router();

router.get("/", getClearanceRecords);
router.post("/", createClearanceRecord);
router.get("/:id", getClearanceRecordById);
router.put("/:id", updateClearanceRecord);
router.delete("/:id", deleteClearanceRecord);

module.exports = router;
