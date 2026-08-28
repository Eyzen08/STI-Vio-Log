const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createPasswordChangeService } = require('../services/passwordChangeService');
const createAccountController = ({ service=createPasswordChangeService({pool}) }={}) => ({
  passwordChange: async (req,res) => { try {
    assertAllowedFields(req.body,['current_password','new_password']);
    if (typeof req.body?.current_password !== 'string' || typeof req.body?.new_password !== 'string') return sendError(res,400,'VALIDATION_ERROR','current_password and new_password are required');
    const result=await service.change({userId:req.user.id,currentPassword:req.body.current_password,newPassword:req.body.new_password,ipAddress:req.ip||null});
    return res.json({success:true,message:'Password changed successfully',...result});
  } catch(error) { return sendError(res,error.statusCode||500,error.code||'INTERNAL_ERROR',error.statusCode?error.message:'Password change failed'); } }
});
module.exports={createAccountController,...createAccountController()};
