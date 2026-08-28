const express = require("express");

const {
    getViolationTypes,
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation,
    performViolationAction,
    getViolationActions
} = require("../controllers/violationController");

const router = express.Router();

router.get("/types", getViolationTypes);
router.get("/", getViolations);
router.post("/", createViolation);
router.get("/:id/actions", getViolationActions);
router.post("/:id/actions", performViolationAction);
router.get("/:id", getViolationById);
router.put("/:id", updateViolation);
router.delete("/:id", deleteViolation);

module.exports = router;
