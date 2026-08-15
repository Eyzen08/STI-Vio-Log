const express = require("express");

const {
    getCommunityServiceAssignments,
    getCommunityServiceAssignmentById,
    createCommunityServiceAssignment,
    updateCommunityServiceAssignment,
    deleteCommunityServiceAssignment
} = require("../controllers/communityServiceController");

const router = express.Router();

router.get("/", getCommunityServiceAssignments);
router.post("/", createCommunityServiceAssignment);
router.get("/:id", getCommunityServiceAssignmentById);
router.put("/:id", updateCommunityServiceAssignment);
router.delete("/:id", deleteCommunityServiceAssignment);

module.exports = router;
