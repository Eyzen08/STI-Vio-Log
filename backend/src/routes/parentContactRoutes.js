const express = require('express');
const { read, record } = require('../controllers/parentContactController');

const router = express.Router();
const { authorizePermissions } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');
router.get('/:studentId', authorizePermissions(PERMISSIONS.GUARDIAN_CONTACT_VIEW), read);
router.post('/:studentId', authorizePermissions(PERMISSIONS.GUARDIAN_CONTACT_VIEW, PERMISSIONS.STUDENT_MANAGE), record);

module.exports = router;
