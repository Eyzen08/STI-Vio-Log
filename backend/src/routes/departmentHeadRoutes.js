const express = require("express");

const {
    getDepartmentHeads,
    getDepartmentHeadById,
    createDepartmentHead,
    updateDepartmentHead,
    deleteDepartmentHead
} = require("../controllers/departmentHeadController");

const router = express.Router();

router.get("/", getDepartmentHeads);
router.post("/", createDepartmentHead);
router.get("/:id", getDepartmentHeadById);
router.put("/:id", updateDepartmentHead);
router.delete("/:id", deleteDepartmentHead);

module.exports = router;
