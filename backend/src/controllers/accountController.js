const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createPasswordChangeService } = require('../services/passwordChangeService');
const { createAdminAccountService } = require('../services/adminAccountService');
const { createOtpService } = require('../services/otpService');
const { createEmailService } = require('../services/emailService');
const createAccountController = ({ service=createPasswordChangeService({pool}) }={}) => ({
  passwordChange: async (req,res) => { try {
    assertAllowedFields(req.body,['current_password','new_password']);
    if (typeof req.body?.current_password !== 'string' || typeof req.body?.new_password !== 'string') return sendError(res,400,'VALIDATION_ERROR','current_password and new_password are required');
    const result=await service.change({userId:req.user.id,currentPassword:req.body.current_password,newPassword:req.body.new_password,ipAddress:req.ip||null});
    return res.json({success:true,message:'Password changed successfully',...result});
  } catch(error) { return sendError(res,error.statusCode||500,error.code||'INTERNAL_ERROR',error.statusCode?error.message:'Password change failed'); } }
});
const createAdminProfileController=({service=createAdminAccountService({pool,otpService:createOtpService({pool,sendOtp:createEmailService().sendOtp})})}={})=>{const fail=(res,e)=>sendError(res,e.statusCode||500,e.code||'INTERNAL_ERROR',e.statusCode?e.message:'Account settings request failed');return{
  profile:async(req,res)=>{try{return res.json({success:true,profile:await service.getProfile({userId:req.user.id})})}catch(e){return fail(res,e)}},
  updateProfile:async(req,res)=>{try{assertAllowedFields(req.body,['first_name','last_name','username','email']);return res.json({success:true,message:'Account profile updated',...await service.updateProfile({userId:req.user.id,firstName:req.body?.first_name,lastName:req.body?.last_name,username:req.body?.username,email:req.body?.email,ipAddress:req.ip||null})})}catch(e){return fail(res,e)}},
  resendEmail:async(req,res)=>{try{assertAllowedFields(req.body,[]);return res.json({success:true,...await service.resendEmailVerification({userId:req.user.id})})}catch(e){return fail(res,e)}},
  verifyEmail:async(req,res)=>{try{assertAllowedFields(req.body,['code']);return res.json({success:true,message:'Recovery email verified',...await service.verifyEmail({userId:req.user.id,code:req.body?.code,ipAddress:req.ip||null})})}catch(e){return fail(res,e)}}
}};
module.exports={createAccountController,createAdminProfileController,...createAccountController(),...createAdminProfileController()};
