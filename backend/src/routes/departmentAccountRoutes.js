const express = require('express');
const { list, options, create, status, reset } = require('../controllers/departmentAccountController');
const router = express.Router();
router.get('/', list);
router.get('/options', options);
router.post('/', create);
router.patch('/:id/status', status);
router.post('/:id/password-reset', reset);
module.exports = router;
