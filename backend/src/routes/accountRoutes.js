const express=require('express');
const {passwordChange}=require('../controllers/accountController');
const router=express.Router();
router.post('/password-change',passwordChange);
module.exports=router;
