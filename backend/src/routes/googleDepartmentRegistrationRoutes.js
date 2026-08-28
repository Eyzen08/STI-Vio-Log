const express = require('express');
const { list, approve, reject } = require('../controllers/googleDepartmentRegistrationController');
const router = express.Router();
router.get('/', list);
router.post('/:id/approve', approve);
router.post('/:id/reject', reject);
module.exports = router;
