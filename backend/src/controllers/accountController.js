const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createPasswordChangeService } = require('../services/passwordChangeService');
const { createAdminAccountService } = require('../services/adminAccountService');
const { createOtpService } = require('../services/otpService');
const { createEmailService } = require('../services/emailService');
const sessions=require('../services/browserSessionService');
const { createGoogleIdentityVerifier }=require('../services/googleIdentityVerifier');
const { createGoogleIdentityService }=require('../services/googleIdentityService');
const { createStudentOnboardingService }=require('../services/studentOnboardingService');
const createAccountController = ({ service=createPasswordChangeService({pool,issueToken:()=>null}) }={}) => ({
  passwordChange: async (req,res) => { try {
    assertAllowedFields(req.body,['current_password','new_password']);
    if (typeof req.body?.current_password !== 'string' || typeof req.body?.new_password !== 'string') return sendError(res,400,'VALIDATION_ERROR','current_password and new_password are required');
    const result=await service.change({userId:req.user.id,currentPassword:req.body.current_password,newPassword:req.body.new_password,ipAddress:req.ip||null});
    await sessions.revokeUserSessions(req.user.id);
    const created=await sessions.createSession({userId:req.user.id,ipAddress:req.ip,userAgent:req.get('user-agent')});sessions.setSessionCookies(res,created);
    return res.json({success:true,message:'Password changed successfully',user:result.user,csrf_token:created.csrf});
  } catch(error) { return sendError(res,error.statusCode||500,error.code||'INTERNAL_ERROR',error.statusCode?error.message:'Password change failed'); } }
});
const createStudentOnboardingController=({googleService=null,onboardingService=createStudentOnboardingService({pool})}={})=>{
  let google=googleService;const getGoogle=()=>google||(google=createGoogleIdentityService({pool,verifyIdentity:createGoogleIdentityVerifier(),issueToken:()=>null}));
  return {
  googleLink:async(req,res)=>{try{assertAllowedFields(req.body,['credential']);if(req.user.role!=='STUDENT')return sendError(res,403,'FORBIDDEN','Student account required');if(typeof req.body?.credential!=='string'||!req.body.credential.trim())return sendError(res,400,'VALIDATION_ERROR','credential is required');const result=await getGoogle().linkAuthenticatedStudent({userId:req.user.id,credential:req.body.credential,ipAddress:req.ip||null});return res.json({success:true,message:'Google account linked successfully',user:result.user});}catch(error){return sendError(res,error.statusCode||500,error.code||'INTERNAL_ERROR',error.statusCode?error.message:'Google account linking failed')}},
  completeOnboarding:async(req,res)=>{try{assertAllowedFields(req.body,['phone_number','guardian_name','guardian_relationship','guardian_phone_number']);if(req.user.role!=='STUDENT')return sendError(res,403,'FORBIDDEN','Student account required');const state=await onboardingService.completeProfile({userId:req.user.id,phoneNumber:req.body?.phone_number,guardianName:req.body?.guardian_name,guardianRelationship:req.body?.guardian_relationship,guardianPhoneNumber:req.body?.guardian_phone_number,ipAddress:req.ip||null});return res.json({success:true,message:'Student onboarding completed',user:sessions.publicUser({...req.user,must_change_password:false,...state,onboarding_required:false,onboarding_completed_at:new Date()})});}catch(error){return sendError(res,error.statusCode||500,error.code||'INTERNAL_ERROR',error.statusCode?error.message:'Unable to complete student onboarding')}}
  };
};
const createAdminProfileController=({service=createAdminAccountService({pool,otpService:createOtpService({pool,sendOtp:createEmailService().sendOtp})})}={})=>{const fail=(res,e)=>sendError(res,e.statusCode||500,e.code||'INTERNAL_ERROR',e.statusCode?e.message:'Account settings request failed');return{
  profile:async(req,res)=>{try{return res.json({success:true,profile:await service.getProfile({userId:req.user.id})})}catch(e){return fail(res,e)}},
  updateProfile:async(req,res)=>{try{assertAllowedFields(req.body,['first_name','last_name','username','email']);return res.json({success:true,message:'Account profile updated',...await service.updateProfile({userId:req.user.id,firstName:req.body?.first_name,lastName:req.body?.last_name,username:req.body?.username,email:req.body?.email,ipAddress:req.ip||null})})}catch(e){return fail(res,e)}},
  resendEmail:async(req,res)=>{try{assertAllowedFields(req.body,[]);return res.json({success:true,...await service.resendEmailVerification({userId:req.user.id})})}catch(e){return fail(res,e)}},
  verifyEmail:async(req,res)=>{try{assertAllowedFields(req.body,['code']);return res.json({success:true,message:'Recovery email verified',...await service.verifyEmail({userId:req.user.id,code:req.body?.code,ipAddress:req.ip||null})})}catch(e){return fail(res,e)}}
}};
module.exports={createAccountController,createAdminProfileController,createStudentOnboardingController,...createAccountController(),...createAdminProfileController(),...createStudentOnboardingController()};
