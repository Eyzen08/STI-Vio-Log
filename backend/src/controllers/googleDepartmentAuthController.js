const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createGoogleIdentityVerifier } = require('../services/googleIdentityVerifier');
const { createGoogleDepartmentIdentityService } = require('../services/googleDepartmentIdentityService');

const defaultFactory = () => createGoogleDepartmentIdentityService({ pool, verifyIdentity: createGoogleIdentityVerifier() });
const createGoogleDepartmentAuthController = ({ serviceFactory = defaultFactory } = {}) => {
  let service;
  const getService = () => service || (service = serviceFactory());
  const fail = (res, error) => sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Google department authentication failed');
  const register = async (req, res) => {
    try {
      assertAllowedFields(req.body, ['credential','first_name','last_name','employee_number','department_type','department_name','note']);
      const { credential, first_name, last_name, employee_number, department_type, department_name, note } = req.body || {};
      if (![credential, first_name, last_name, department_type, department_name].every((value) => typeof value === 'string' && value.trim())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Google credential, officer name, department type, and department name are required');
      }
      const result = await getService().register({ credential, firstName:first_name, lastName:last_name, employeeNumber:employee_number, departmentType:department_type, departmentName:department_name, note, ipAddress:req.ip || null });
      return res.status(202).json({ success:true, ...result });
    } catch (error) { return fail(res,error); }
  };
  const login = async (req,res) => {
    try {
      assertAllowedFields(req.body, ['credential']);
      if (typeof req.body?.credential !== 'string' || !req.body.credential.trim()) return sendError(res,400,'VALIDATION_ERROR','credential is required');
      const result = await getService().login({ credential:req.body.credential, ipAddress:req.ip || null });
      return res.json({ success:true, message:'Login successful', ...result });
    } catch (error) { return fail(res,error); }
  };
  return { register, login };
};
module.exports = { createGoogleDepartmentAuthController, ...createGoogleDepartmentAuthController() };
