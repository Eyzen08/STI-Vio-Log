const express = require('express');
const { read, record } = require('../controllers/parentContactController');

const router = express.Router();
router.get('/:studentId', read);
router.post('/:studentId', record);

module.exports = router;

