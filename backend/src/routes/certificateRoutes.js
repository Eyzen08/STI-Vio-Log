const express = require('express');
const { verifyClearanceCertificate } = require('../controllers/clearanceCertificateController');
const router = express.Router();
router.get('/clearance/:code', verifyClearanceCertificate);
module.exports = router;
