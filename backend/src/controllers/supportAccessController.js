const pool = require('../config/database');
const { createSupportAccessService } = require('../services/supportAccessService');
const { assertAllowedFields } = require('../utils/validators');
const service = createSupportAccessService({ pool });
const fail = (res, error) => res.status(error.statusCode || 500).json({ success:false, error:{ code:error.code || 'SUPPORT_ACCESS_FAILED', message:error.statusCode ? error.message : 'Support access operation failed' } });

module.exports = {
  request: async (req,res) => { try { assertAllowedFields(req.body,['reason','affected_module','scopes','duration_minutes','ticket_reference','read_only','write_operation','write_justification']); return res.status(201).json({success:true,request:await service.request({requesterId:req.user.id,reason:req.body.reason,affectedModule:req.body.affected_module,scopes:req.body.scopes,durationMinutes:req.body.duration_minutes,ticketReference:req.body.ticket_reference,readOnly:req.body.read_only,writeOperation:req.body.write_operation,writeJustification:req.body.write_justification})}); } catch(error){return fail(res,error);} },
  list: async (req,res) => { try { return res.json({success:true,requests:await service.list({actorId:req.user.id,actorRole:req.user.role})}); } catch(error){return fail(res,error);} },
  decide: async (req,res) => { try { assertAllowedFields(req.body,['approve','scopes','reason']); return res.json({success:true,request:await service.decide({approverId:req.user.id,requestId:req.params.id,approve:req.body.approve===true,scopes:req.body.scopes,decisionReason:req.body.reason})}); } catch(error){return fail(res,error);} },
  revoke: async (req,res) => { try { assertAllowedFields(req.body,['reason']); return res.json({success:true,request:await service.revoke({actorId:req.user.id,actorRole:req.user.role,requestId:req.params.id,reason:req.body.reason})}); } catch(error){return fail(res,error);} }
};
