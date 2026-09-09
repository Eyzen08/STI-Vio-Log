const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');

const ADMIN_ROLES = new Set(['SYSTEM_ADMIN','DISCIPLINE_ADMIN']);
const cleanReason = (value) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,1000) : '';

const createSystemAccountSecurityService = ({ pool, hashPassword=(value)=>bcrypt.hash(value,12), randomBytes=crypto.randomBytes }={}) => {
  if(!pool?.connect) throw new TypeError('System account-security dependencies are required');

  const lock = async ({ actorId, targetId, reason }) => {
    const why=cleanReason(reason);
    if(!isPositiveId(actorId)||!isPositiveId(targetId)||why.length<10) throw new ApiError(400,'VALIDATION_ERROR','A target account and reason of at least 10 characters are required');
    if(Number(actorId)===Number(targetId)) throw new ApiError(409,'SELF_ACCOUNT_CHANGE','You cannot lock your own active account');
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('active-administrator-guard'))");
      const target=(await client.query('SELECT id,username,role,is_active FROM users WHERE id=$1 FOR UPDATE',[Number(targetId)])).rows[0];
      if(!target) throw new ApiError(404,'ACCOUNT_NOT_FOUND','Account not found');
      if(!target.is_active) throw new ApiError(409,'ACCOUNT_ALREADY_LOCKED','Account is already inactive');
      if(ADMIN_ROLES.has(target.role)){
        const count=(await client.query('SELECT COUNT(*)::int count FROM users WHERE role=$1 AND is_active=TRUE',[target.role])).rows[0];
        if(Number(count.count)<=1) throw new ApiError(409,'LAST_ADMIN',`The last active ${target.role.replaceAll('_',' ').toLowerCase()} cannot be locked`);
      }
      const row=(await client.query(`UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP,deactivated_by=$2,
        session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,username,role,is_active,session_version`,[target.id,Number(actorId)])).rows[0];
      await client.query("INSERT INTO audit_logs(user_id,action,table_name,record_id,description)VALUES($1,'ACCOUNT_LOCK','users',$2,$3)",[Number(actorId),target.id,`Locked compromised account: ${why}`]);
      await client.query('COMMIT');
      return row;
    } catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
  };

  const initiateRecovery = async ({ actorId, targetId, reason }) => {
    const why=cleanReason(reason);
    if(!isPositiveId(actorId)||!isPositiveId(targetId)||why.length<10) throw new ApiError(400,'VALIDATION_ERROR','A target account and recovery reason of at least 10 characters are required');
    if(Number(actorId)===Number(targetId)) throw new ApiError(409,'SELF_RECOVERY_NOT_ALLOWED','Use the verified self-service recovery flow for your own account');
    const temporaryPassword=randomBytes(18).toString('base64url')+'!Aa1';
    const passwordHash=await hashPassword(temporaryPassword);
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const target=(await client.query("SELECT id,username,role FROM users WHERE id=$1 AND role<>'STUDENT' FOR UPDATE",[Number(targetId)])).rows[0];
      if(!target) throw new ApiError(404,'ACCOUNT_NOT_FOUND','Staff account not found');
      await client.query(`UPDATE users SET password_hash=$2,is_active=TRUE,deactivated_at=NULL,deactivated_by=NULL,
        must_change_password=TRUE,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[target.id,passwordHash]);
      await client.query("INSERT INTO audit_logs(user_id,action,table_name,record_id,description)VALUES($1,'ACCOUNT_RECOVERY_INITIATED','users',$2,$3)",[Number(actorId),target.id,`Initiated controlled account recovery: ${why}`]);
      await client.query('COMMIT');
      return { account:{id:Number(target.id),username:target.username,role:target.role}, temporary_password:temporaryPassword };
    } catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
  };

  return { lock, initiateRecovery };
};

module.exports={createSystemAccountSecurityService};
