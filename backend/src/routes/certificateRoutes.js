const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyClearanceCertificate } = require('../controllers/clearanceCertificateController');
const router = express.Router();
const certificateVerificationLimiter = rateLimit({ windowMs:15*60*1000, limit:30, standardHeaders:true, legacyHeaders:false,
  message:{ success:false, message:'Too many certificate verification attempts. Please try again later.' } });
router.get('/clearance/:code', certificateVerificationLimiter, verifyClearanceCertificate);
module.exports = router;
