const pool=require('../config/database');
const {assertAllowedFields}=require('../utils/validators');
const {sendError}=require('../utils/api');
const {createHighRiskActionService}=require('../services/highRiskActionService');
const service=createHighRiskActionService({pool});
const fail=(res,error)=>sendError(res,error.statusCode||500,error.code||'HIGH_RISK_ACTION_FAILED',error.statusCode?error.message:'High-risk action failed');

module.exports={
  stepUp:async(req,res)=>{try{assertAllowedFields(req.body,['password','action_type','target_type','target_id']);return res.json({success:true,step_up:await service.verifyStepUp({userId:req.user.id,password:req.body.password,actionType:req.body.action_type,targetType:req.body.target_type,targetId:req.body.target_id})})}catch(error){return fail(res,error)}},
  list:async(req,res)=>{try{assertAllowedFields(req.query,['status','limit']);return res.json({success:true,requests:await service.list({actorId:req.user.id,actorRole:req.user.role,status:req.query.status,limit:req.query.limit})})}catch(error){return fail(res,error)}},
  create:async(req,res)=>{try{assertAllowedFields(req.body,['action_type','target_id','reason','step_up_token']);return res.status(201).json({success:true,request:await service.create({requesterId:req.user.id,actionType:req.body.action_type,targetId:req.body.target_id,reason:req.body.reason,stepUpToken:req.body.step_up_token})})}catch(error){return fail(res,error)}},
  decide:async(req,res)=>{try{assertAllowedFields(req.body,['approve','reason']);return res.json({success:true,request:await service.decide({approverId:req.user.id,requestId:req.params.id,approve:req.body.approve===true,reason:req.body.reason})})}catch(error){return fail(res,error)}},
  cancel:async(req,res)=>{try{assertAllowedFields(req.body,['reason']);return res.json({success:true,request:await service.cancel({requesterId:req.user.id,requestId:req.params.id,reason:req.body.reason})})}catch(error){return fail(res,error)}},
  execute:async(req,res)=>{try{assertAllowedFields(req.body,['step_up_token']);return res.json({success:true,...await service.execute({requesterId:req.user.id,requestId:req.params.id,stepUpToken:req.body.step_up_token})})}catch(error){return fail(res,error)}}
};

