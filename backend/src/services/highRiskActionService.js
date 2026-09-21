const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { createSystemAccountSecurityService } = require('./systemAccountSecurityService');

const clean = (value, max = 1000) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const apiError = (statusCode, code, message) => new ApiError(statusCode, code, message);

const createHighRiskActionService = ({ pool, comparePassword = bcrypt.compare, randomBytes = crypto.randomBytes } = {}) => {
  const accountSecurity = createSystemAccountSecurityService({ pool });
  const registry = Object.freeze({
    ACCOUNT_LOCK: {
      targetType: 'USER_ACCOUNT',
      describe: (row) => ({ id:Number(row.id), username:row.username, role:row.role, is_active:Boolean(row.is_active), must_change_password:Boolean(row.must_change_password), session_version:Number(row.session_version) }),
      execute: ({ actorId, targetId, reason, expectedVersion }) => accountSecurity.lock({ actorId, targetId, reason, expectedVersion })
    },
    ACCOUNT_RECOVERY: {
      targetType: 'USER_ACCOUNT',
      describe: (row) => ({ id:Number(row.id), username:row.username, role:row.role, is_active:Boolean(row.is_active), must_change_password:Boolean(row.must_change_password), session_version:Number(row.session_version) }),
      execute: ({ actorId, targetId, reason, expectedVersion }) => accountSecurity.initiateRecovery({ actorId, targetId, reason, expectedVersion })
    }
  });

  const target = async (targetId, database = pool) => {
    const row = (await database.query('SELECT id,username,role,is_active,must_change_password,session_version FROM users WHERE id=$1', [Number(targetId)])).rows[0];
    if (!row) throw apiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return row;
  };

  const verifyStepUp = async ({ userId, password, actionType, targetType, targetId }) => {
    const entry=registry[actionType];
    if(!entry||entry.targetType!==targetType) throw apiError(400,'ACTION_NOT_REGISTERED','This high-risk action is not registered');
    if(typeof password!=='string'||!password) throw apiError(400,'PASSWORD_REQUIRED','Current password is required');
    const user=(await pool.query('SELECT id,password_hash,role,is_active FROM users WHERE id=$1',[Number(userId)])).rows[0];
    if(!user?.is_active||user.role!=='DISCIPLINE_ADMIN'||!(await comparePassword(password,user.password_hash))) throw apiError(401,'INVALID_CREDENTIALS','Current password is incorrect');
    const currentTarget=await target(targetId);
    const token=randomBytes(32).toString('base64url');
    await pool.query(`INSERT INTO administrative_step_up_tokens(user_id,token_hash,action_type,target_type,target_id,target_version,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP+INTERVAL '5 minutes')`,[Number(userId),digest(token),actionType,targetType,String(targetId),String(currentTarget.session_version)]);
    return {token,expires_in_seconds:300};
  };

  const consumeStepUp = async ({ client, userId, token, actionType, targetType, targetId }) => {
    if(!token) throw apiError(401,'STEP_UP_REQUIRED','Recent password confirmation is required');
    const result=await client.query(`UPDATE administrative_step_up_tokens SET consumed_at=CURRENT_TIMESTAMP
      WHERE token_hash=$1 AND user_id=$2 AND action_type=$3 AND target_type=$4 AND target_id=$5
        AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING id,target_version`,[digest(token),Number(userId),actionType,targetType,String(targetId)]);
    if(!result.rowCount) throw apiError(401,'STEP_UP_INVALID','Password confirmation expired, was already used, or does not match this action');
    return result.rows[0];
  };

  const executeDirect = async ({ requesterId, actionType, targetId, reason, stepUpToken }) => {
    const entry=registry[actionType]; const why=clean(reason);
    if(!entry) throw apiError(400,'ACTION_NOT_REGISTERED','This high-risk action is not registered');
    if(why.length<10) throw apiError(400,'REASON_REQUIRED','Enter a reason of at least 10 characters');
    const before=entry.describe(await target(targetId));
    const client=await pool.connect(); let confirmation;
    try {
      await client.query('BEGIN');
      confirmation=await consumeStepUp({client,userId:requesterId,token:stepUpToken,actionType,targetType:entry.targetType,targetId});
      await client.query('COMMIT');
    } catch(error) { try{await client.query('ROLLBACK')}catch(_){} throw error; }
    finally { client.release(); }
    try {
      const output=await entry.execute({actorId:requesterId,targetId,reason:why,expectedVersion:confirmation.target_version});
      const safe=entry.describe(output.account||output);
      const request=(await pool.query(`INSERT INTO high_risk_action_requests(requester_user_id,action_type,target_type,target_id,target_version,reason,request_summary,before_summary,after_summary,status,executed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'EXECUTED',CURRENT_TIMESTAMP) RETURNING *`,[Number(requesterId),actionType,entry.targetType,String(targetId),String(confirmation.target_version),why,JSON.stringify({action:actionType,target:before.username}),JSON.stringify(before),JSON.stringify(safe)])).rows[0];
      return {request,result:output};
    } catch(error) {
      await pool.query(`INSERT INTO high_risk_action_requests(requester_user_id,action_type,target_type,target_id,target_version,reason,request_summary,before_summary,status,execution_error_code)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'FAILED',$9)`,[Number(requesterId),actionType,entry.targetType,String(targetId),String(confirmation.target_version),why,JSON.stringify({action:actionType,target:before.username}),JSON.stringify(before),error.code||'EXECUTION_FAILED']);
      throw error;
    }
  };

  const list = async ({ status, limit=50 }) => {
    const params=[];const where=[];
    if(status){params.push(status);where.push(`status=$${params.length}`)}
    params.push(Math.min(Math.max(Number(limit)||50,1),100));
    return (await pool.query(`SELECT r.*,ru.username requester_username,au.username approver_username
      FROM high_risk_action_requests r JOIN users ru ON ru.id=r.requester_user_id LEFT JOIN users au ON au.id=r.approver_user_id
      ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY r.created_at DESC,r.id DESC LIMIT $${params.length}`,params)).rows;
  };

  return {registry,verifyStepUp,executeDirect,list};
};

module.exports={createHighRiskActionService};
