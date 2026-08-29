const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createGoogleDepartmentRegistrationService } = require('../services/googleDepartmentRegistrationService');
const createGoogleDepartmentRegistrationController = ({ service = createGoogleDepartmentRegistrationService({ pool }) } = {}) => {
  const fail = (res,error) => sendError(res,error.statusCode || 500,error.code || 'INTERNAL_ERROR',error.statusCode ? error.message : 'Department registration review failed');
  const list = async (req,res) => { try { assertAllowedFields(req.query,['status','limit']); return res.json({ success:true, ...(await service.list(req.query)) }); } catch(error) { return fail(res,error); } };
  const decide = (decision) => async (req,res) => { try {
    assertAllowedFields(req.body, decision === 'APPROVED' ? ['reason','department_id'] : ['reason']);
    const registration = await service.review({ registrationId:req.params.id, reviewerId:req.user.id, decision, reason:req.body?.reason, departmentId:req.body?.department_id });
    return res.json({ success:true, message:`Department registration ${decision.toLowerCase()}`, registration });
  } catch(error) { return fail(res,error); } };
  return { list, approve:decide('APPROVED'), reject:decide('REJECTED') };
};
module.exports = { createGoogleDepartmentRegistrationController, ...createGoogleDepartmentRegistrationController() };
