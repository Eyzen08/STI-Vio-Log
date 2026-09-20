const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createGoogleIdentityVerifier } = require('../services/googleIdentityVerifier');
const { createGoogleIdentityService } = require('../services/googleIdentityService');
const sessions=require('../services/browserSessionService');
const authThrottle=require('../services/authThrottleService');

const defaultServiceFactory = () => createGoogleIdentityService({ pool, verifyIdentity: createGoogleIdentityVerifier(), issueToken:()=>null, authThrottle });

const createGoogleAuthController = ({ serviceFactory = defaultServiceFactory } = {}) => {
  let service;
  const getService = () => service || (service = serviceFactory());

  const fail = (res, error) => {
    const status = error.statusCode || 500;
    return sendError(res, status, error.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'), status === 500 ? 'Google authentication failed' : error.message);
  };

  const link = async (req, res) => {
    try {
      assertAllowedFields(req.body, ['credential', 'student_number', 'first_name', 'last_name']);
      const { credential, student_number, first_name, last_name } = req.body || {};
      if (![credential, student_number, first_name, last_name].every((value) => typeof value === 'string' && value.trim())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Google credential, student number, and student name are required');
      }
      const result = await getService().linkStudent({ credential, studentNumber: student_number, firstName: first_name, lastName: last_name, ipAddress: req.ip || null });
      if(result.token)return res.json({success:true,message:'Google account linked successfully',...result});
      const created=await sessions.createSession({userId:result.user.id,ipAddress:req.ip,userAgent:req.get('user-agent')});sessions.setSessionCookies(res,created);
      return res.json({ success: true, message: 'Google account linked successfully', user:result.user,csrf_token:created.csrf });
    } catch (error) { return fail(res, error); }
  };

  const login = async (req, res) => {
    try {
      assertAllowedFields(req.body, ['credential']);
      if (typeof req.body?.credential !== 'string' || !req.body.credential.trim()) return sendError(res, 400, 'VALIDATION_ERROR', 'credential is required');
      const result = await getService().loginStudent({ credential: req.body.credential, ipAddress: req.ip || null });
      if(result.token)return res.json({success:true,message:'Login successful',...result});
      const created=await sessions.createSession({userId:result.user.id,ipAddress:req.ip,userAgent:req.get('user-agent')});sessions.setSessionCookies(res,created);
      return res.json({ success: true, message: 'Login successful', user:result.user,csrf_token:created.csrf });
    } catch (error) { return fail(res, error); }
  };

  return { link, login };
};

module.exports = { createGoogleAuthController, ...createGoogleAuthController() };
