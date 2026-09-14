const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { createSystemAccountSecurityService } = require('./systemAccountSecurityService');
const { insertNotification } = require('./notificationService');

const clean = (value, max = 1000) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const apiError = (statusCode, code, message) => new ApiError(statusCode, code, message);

const createHighRiskActionService = ({ pool, comparePassword = bcrypt.compare, randomBytes = crypto.randomBytes, now = () => new Date() } = {}) => {
  const accountSecurity = createSystemAccountSecurityService({ pool });
  const registry = Object.freeze({
    ACCOUNT_LOCK: {
      targetType: 'USER_ACCOUNT',
      describe: (row) => ({ id:Number(row.id), username:row.username, role:row.role, is_active:Boolean(row.is_active), session_version:Number(row.session_version) }),
      execute: ({ actorId, targetId, reason }) => accountSecurity.lock({ actorId, targetId, reason })
    },
    ACCOUNT_RECOVERY: {
      targetType: 'USER_ACCOUNT',
      describe: (row) => ({ id:Number(row.id), username:row.username, role:row.role, is_active:Boolean(row.is_active), session_version:Number(row.session_version) }),
      execute: ({ actorId, targetId, reason }) => accountSecurity.initiateRecovery({ actorId, targetId, reason })
    }
  });

  const expire = async () => pool.query(`UPDATE high_risk_action_requests SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP
    WHERE status='APPROVED' AND approval_expires_at<=CURRENT_TIMESTAMP`);

  const target = async (targetId, client = pool) => {
    const row = (await client.query('SELECT id,username,role,is_active,session_version FROM users WHERE id=$1', [Number(targetId)])).rows[0];
    if (!row) throw apiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return row;
  };

  const notify = async (userId, title, message, requestId) => {
    try { await insertNotification(pool,{userId,title,message,type:'HIGH_RISK_ACTION',eventKey:`high-risk:${requestId}:${userId}:${title}`,category:'SECURITY',severity:'WARNING',resourceType:'high_risk_action_requests',resourceId:requestId,linkPath:'/system/action-requests'}); } catch (_) {}
  };

  const verifyStepUp = async ({ userId, password, actionType, targetType, targetId }) => {
    if (typeof password !== 'string' || !password) throw apiError(400,'PASSWORD_REQUIRED','Current password is required');
    const user=(await pool.query('SELECT id,password_hash,role,is_active FROM users WHERE id=$1',[Number(userId)])).rows[0];
    if(!user?.is_active || !(await comparePassword(password,user.password_hash))) throw apiError(401,'INVALID_CREDENTIALS','Current password is incorrect');
    const token=randomBytes(32).toString('base64url');
    await pool.query(`INSERT INTO administrative_step_up_tokens(user_id,token_hash,action_type,target_type,target_id,expires_at)
      VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP+INTERVAL '5 minutes')`,[Number(userId),digest(token),actionType,targetType,String(targetId)]);
    return { token, expires_in_seconds:300 };
  };

  const consumeStepUp = async ({ client, userId, token, actionType, targetType, targetId }) => {
    if(!token) throw apiError(401,'STEP_UP_REQUIRED','Recent password confirmation is required');
    const result=await client.query(`UPDATE administrative_step_up_tokens SET consumed_at=CURRENT_TIMESTAMP
      WHERE token_hash=$1 AND user_id=$2 AND action_type=$3 AND target_type=$4 AND target_id=$5
        AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING id`,[digest(token),Number(userId),actionType,targetType,String(targetId)]);
    if(!result.rowCount) throw apiError(401,'STEP_UP_INVALID','Password confirmation expired, was already used, or does not match this action');
  };

  const create = async ({ requesterId, actionType, targetId, reason, stepUpToken }) => {
    const entry=registry[actionType]; const why=clean(reason);
    if(!entry) throw apiError(400,'ACTION_NOT_REGISTERED','This high-risk action is not registered');
    if(why.length<10) throw apiError(400,'REASON_REQUIRED','Enter a reason of at least 10 characters');
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await consumeStepUp({client,userId:requesterId,token:stepUpToken,actionType,targetType:entry.targetType,targetId});
      const row=await target(targetId,client); const before=entry.describe(row); const version=String(row.session_version);
      const request=(await client.query(`INSERT INTO high_risk_action_requests(requester_user_id,action_type,target_type,target_id,target_version,reason,request_summary,before_summary)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING *`,[Number(requesterId),actionType,entry.targetType,String(targetId),version,why,JSON.stringify({action:actionType,target:before.username}),JSON.stringify(before)])).rows[0];
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description) VALUES($1,'HIGH_RISK_ACTION_REQUEST','high_risk_action_requests',$2,$3)`,[Number(requesterId),request.id,`Requested ${actionType}: ${why}`]);
      await client.query('COMMIT');
      const approvers=(await pool.query("SELECT id FROM users WHERE role='DISCIPLINE_ADMIN' AND is_active=TRUE")).rows;
      await Promise.all(approvers.map((item)=>notify(item.id,'High-risk action awaiting approval',`${actionType.replaceAll('_',' ').toLowerCase()} request #${request.id} requires review.`,request.id)));
      return request;
    } catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
  };

  const list = async ({ actorId, actorRole, status, limit=50 }) => {
    await expire(); const params=[]; const where=[];
    if(actorRole==='SYSTEM_ADMIN'){params.push(Number(actorId));where.push(`requester_user_id=$${params.length}`)}
    if(status){params.push(status);where.push(`status=$${params.length}`)}
    params.push(Math.min(Math.max(Number(limit)||50,1),100));
    const rows=(await pool.query(`SELECT r.*,ru.username requester_username,au.username approver_username
      FROM high_risk_action_requests r JOIN users ru ON ru.id=r.requester_user_id LEFT JOIN users au ON au.id=r.approver_user_id
      ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY r.created_at DESC,r.id DESC LIMIT $${params.length}`,params)).rows;
    return rows;
  };

  const decide = async ({ approverId, requestId, approve, reason }) => {
    const why=clean(reason); if(why.length<10)throw apiError(400,'REASON_REQUIRED','Enter a decision reason of at least 10 characters');
    const result=await pool.query(`UPDATE high_risk_action_requests SET status=$2,approver_user_id=$3,decision_reason=$4,
      approved_at=CASE WHEN $2='APPROVED' THEN CURRENT_TIMESTAMP END,
      approval_expires_at=CASE WHEN $2='APPROVED' THEN CURRENT_TIMESTAMP+INTERVAL '15 minutes' END,updated_at=CURRENT_TIMESTAMP
      WHERE id=$1 AND status='PENDING' AND requester_user_id<>$3
        AND EXISTS(SELECT 1 FROM users WHERE id=$3 AND role='DISCIPLINE_ADMIN' AND is_active=TRUE) RETURNING *`,[Number(requestId),approve?'APPROVED':'REJECTED',Number(approverId),why]);
    if(!result.rowCount)throw apiError(409,'ACTION_NOT_DECIDABLE','Request is unavailable, already decided, or cannot be self-approved');
    await pool.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description) VALUES($1,$2,'high_risk_action_requests',$3,$4)`,[Number(approverId),approve?'HIGH_RISK_ACTION_APPROVED':'HIGH_RISK_ACTION_REJECTED',Number(requestId),why]);
    await notify(result.rows[0].requester_user_id,`High-risk action ${approve?'approved':'rejected'}`,`Request #${requestId} was ${approve?'approved':'rejected'}.`,requestId);
    return result.rows[0];
  };

  const cancel = async ({ requesterId, requestId, reason }) => {
    const why=clean(reason); if(why.length<10)throw apiError(400,'REASON_REQUIRED','Enter a cancellation reason of at least 10 characters');
    const result=await pool.query(`UPDATE high_risk_action_requests SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP,decision_reason=$3,updated_at=CURRENT_TIMESTAMP
      WHERE id=$1 AND requester_user_id=$2 AND status IN ('PENDING','APPROVED') RETURNING *`,[Number(requestId),Number(requesterId),why]);
    if(!result.rowCount)throw apiError(409,'ACTION_NOT_CANCELLABLE','Request cannot be cancelled'); return result.rows[0];
  };

  const execute = async ({ requesterId, requestId, stepUpToken }) => {
    await expire(); const request=(await pool.query('SELECT * FROM high_risk_action_requests WHERE id=$1',[Number(requestId)])).rows[0];
    if(!request||Number(request.requester_user_id)!==Number(requesterId)||request.status!=='APPROVED')throw apiError(409,'ACTION_NOT_EXECUTABLE','Request is not approved or has expired');
    const entry=registry[request.action_type]; if(!entry)throw apiError(409,'ACTION_NOT_REGISTERED','Action executor is no longer registered');
    const client=await pool.connect();
    try{await client.query('BEGIN');await consumeStepUp({client,userId:requesterId,token:stepUpToken,actionType:request.action_type,targetType:request.target_type,targetId:request.target_id});
      const current=await target(request.target_id,client);if(String(current.session_version)!==String(request.target_version))throw apiError(409,'TARGET_CHANGED','Target changed after approval; submit a new request');await client.query('COMMIT');
    }catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
    const claimed=await pool.query(`UPDATE high_risk_action_requests SET status='EXECUTED',executed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='APPROVED' RETURNING *`,[request.id]);
    if(!claimed.rowCount)throw apiError(409,'ACTION_ALREADY_EXECUTED','Request was already executed');
    try{const output=await entry.execute({actorId:requesterId,targetId:request.target_id,reason:request.reason});const safe=entry.describe(output.account||output);
      const changed=await pool.query(`UPDATE high_risk_action_requests SET after_summary=$2::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,[request.id,JSON.stringify(safe)]);
      return {request:changed.rows[0],result:output};
    }catch(error){await pool.query(`UPDATE high_risk_action_requests SET status='FAILED',execution_error_code=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='EXECUTED'`,[request.id,error.code||'EXECUTION_FAILED']);throw error}
  };

  return { registry, verifyStepUp, create, list, decide, cancel, execute, expire };
};

module.exports={createHighRiskActionService};
