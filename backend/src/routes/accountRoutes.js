const express=require('express');
const {passwordChange,profile,updateProfile,resendEmail,verifyEmail}=require('../controllers/accountController');
const router=express.Router();
router.post('/password-change',passwordChange);
router.get('/admin-profile',profile);
router.patch('/admin-profile',updateProfile);
router.post('/admin-profile/email/resend',resendEmail);
router.post('/admin-profile/email/verify',verifyEmail);
module.exports=router;
