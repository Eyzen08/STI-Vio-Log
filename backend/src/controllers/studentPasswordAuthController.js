const pool = require('../config/database');
const { sendError } = require('../utils/api');
const { createEmailService } = require('../services/emailService');
const { createOtpService } = require('../services/otpService');
const { createStudentPasswordAuthService } = require('../services/studentPasswordAuthService');
const { assertAllowedFields } = require('../utils/validators');
const authThrottle = require('../services/authThrottleService');

const createStudentPasswordAuthController = ({ service, throttles } = {}) => {
  const limiter = throttles || (service ? null : authThrottle);
  const getService = () => service || (() => {
    const email = createEmailService();
    const otp = createOtpService({ pool, sendOtp: email.sendOtp });
    return createStudentPasswordAuthService({ pool, otpService: otp });
  })();
  const run = (handler, successStatus = 200, throttle = null) => async (req, res) => {
    const throttleInput = throttle ? { kind:throttle.kind, identifier:throttle.identifier(req), ip:req.ip } : null;
    try {
      if(limiter&&throttleInput)await limiter.assertAllowed(throttleInput,pool);
      const result = await handler(getService(), req);
      if(limiter&&throttleInput)await limiter.success(throttleInput,pool).catch(() => {});
      return res.status(successStatus).json({ success: true, ...(result || {}) });
    } catch (error) {
      if(limiter&&throttleInput&&error.code!=='RATE_LIMITED'&&error.statusCode&&error.statusCode<500) {
        await limiter.failure(throttleInput,pool).catch(() => {});
      }
      return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Authentication request failed');
    }
  };
  return {
    register: run((s, req) => { assertAllowedFields(req.body,['full_name','first_name','middle_name','last_name','suffix','student_number','email','phone_number','program','section','year_level','guardian_name','guardian_relationship','guardian_phone_number','password','confirm_password']); return s.register({ fullName:req.body.full_name,firstName:req.body.first_name,middleName:req.body.middle_name,lastName:req.body.last_name,suffix:req.body.suffix,studentNumber:req.body.student_number,email:req.body.email,phoneNumber:req.body.phone_number,program:req.body.program,section:req.body.section,yearLevel:req.body.year_level,guardianName:req.body.guardian_name,guardianRelationship:req.body.guardian_relationship,guardianPhoneNumber:req.body.guardian_phone_number,password:req.body.password,confirmPassword:req.body.confirm_password }); }, 202, {kind:'registration',identifier:req=>req.body?.student_number||req.body?.email}),
    resendRegistrationOtp: run((s, req) => { assertAllowedFields(req.body,['registration_id']); return s.resendRegistrationOtp({ registrationId:req.body.registration_id }); },200,{kind:'registration-otp',identifier:req=>req.body?.registration_id}),
    verifyRegistration: run((s, req) => { assertAllowedFields(req.body,['registration_id','code']); return s.verifyRegistration({ registrationId:req.body.registration_id,code:req.body.code,ipAddress:req.ip || null }); },200,{kind:'registration-otp',identifier:req=>req.body?.registration_id}),
    requestPasswordReset: run(async (s, req) => { assertAllowedFields(req.body,['identifier']); await s.requestPasswordReset({ identifier:req.body.identifier }); return { message:'If an account matches the information provided, a verification code has been sent to the registered email.' }; },200,{kind:'password-reset-request',identifier:req=>req.body?.identifier}),
    verifyPasswordReset: run((s, req) => { assertAllowedFields(req.body,['identifier','code']); return s.verifyPasswordReset({ identifier:req.body.identifier,code:req.body.code }); },200,{kind:'password-reset-otp',identifier:req=>req.body?.identifier}),
    resetPassword: run((s, req) => { assertAllowedFields(req.body,['reset_token','new_password','confirm_password']); return s.resetPassword({ resetToken:req.body.reset_token,newPassword:req.body.new_password,confirmPassword:req.body.confirm_password,ipAddress:req.ip || null }); },200,{kind:'password-reset-complete',identifier:req=>req.body?.reset_token})
  };
};

module.exports = { createStudentPasswordAuthController };
