const express = require('express');
const { revoke } = require('../controllers/googleLinkAdministrationController');
const router = express.Router();
router.post('/:studentId/google-link/revoke', revoke);
module.exports = router;
