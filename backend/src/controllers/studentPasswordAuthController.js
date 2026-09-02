const pool = require('../config/database');
const { sendError } = require('../utils/api');
const { createEmailService } = require('../services/emailService');
const { createOtpService } = require('../services/otpService');
const { createStudentPasswordAuthService } = require('../services/studentPasswordAuthService');
const { assertAllowedFields } = require('../utils/validators');

const createStudentPasswordAuthController = ({ service } = {}) => {
  const getService = () => service || (() => {
    const email = createEmailService();
    const otp = createOtpService({ pool, sendOtp: email.sendOtp });
    return createStudentPasswordAuthService({ pool, otpService: otp });
  })();
  const run = (handler, successStatus = 200) => async (req, res) => {
    try {
      const result = await handler(getService(), req);
      return res.status(successStatus).json({ success: true, ...(result || {}) });
    } catch (error) {
      return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Authentication request failed');
    }
  };
  return {
    register: run((s, req) => { assertAllowedFields(req.body,['full_name','student_number','email','password','confirm_password']); return s.register({ fullName:req.body.full_name,studentNumber:req.body.student_number,email:req.body.email,password:req.body.password,confirmPassword:req.body.confirm_password }); }, 202),
    resendRegistrationOtp: run((s, req) => { assertAllowedFields(req.body,['registration_id']); return s.resendRegistrationOtp({ registrationId:req.body.registration_id }); }),
    verifyRegistration: run((s, req) => { assertAllowedFields(req.body,['registration_id','code']); return s.verifyRegistration({ registrationId:req.body.registration_id,code:req.body.code,ipAddress:req.ip || null }); }),
    requestPasswordReset: run(async (s, req) => { assertAllowedFields(req.body,['identifier']); await s.requestPasswordReset({ identifier:req.body.identifier }); return { message:'If an account matches the information provided, a verification code has been sent to the registered email.' }; }),
    verifyPasswordReset: run((s, req) => { assertAllowedFields(req.body,['identifier','code']); return s.verifyPasswordReset({ identifier:req.body.identifier,code:req.body.code }); }),
    resetPassword: run((s, req) => { assertAllowedFields(req.body,['reset_token','new_password','confirm_password']); return s.resetPassword({ resetToken:req.body.reset_token,newPassword:req.body.new_password,confirmPassword:req.body.confirm_password,ipAddress:req.ip || null }); })
  };
};

module.exports = { createStudentPasswordAuthController };
