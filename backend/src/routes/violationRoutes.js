const express = require("express");

const {
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation
} = require("../controllers/violationController");

const router = express.Router();

router.get("/", getViolations);
router.post("/", createViolation);
router.get("/:id", getViolationById);
router.put("/:id", updateViolation);
router.delete("/:id", deleteViolation);

module.exports = router;
