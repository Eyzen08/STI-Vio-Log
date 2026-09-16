const crypto=require('node:crypto');
const pool=require('../config/database');
const digest=(value)=>crypto.createHmac('sha256',process.env.AUTH_THROTTLE_KEY||(process.env.NODE_ENV==='production'?'':process.env.JWT_SECRET)||'development-only-throttle-key').update(String(value)).digest('hex');
const keyFor=({kind,identifier,ip})=>digest(`${kind}:${String(identifier||'').normalize('NFKC').trim().toLowerCase()}:${ip||'unknown'}`);
const assertAllowed=async(input,database=pool)=>{const key=keyFor(input);const row=(await database.query('SELECT blocked_until FROM authentication_throttles WHERE throttle_key=$1',[key])).rows[0];if(row?.blocked_until&&new Date(row.blocked_until)>new Date()){const e=new Error('Too many authentication attempts, please try again later');e.statusCode=429;e.code='RATE_LIMITED';throw e;}return key;};
const failure=async(input,database=pool)=>{const key=keyFor(input);await database.query(`INSERT INTO authentication_throttles(throttle_key,failure_count,blocked_until)
 VALUES($1,1,NULL) ON CONFLICT(throttle_key) DO UPDATE SET
 failure_count=CASE WHEN authentication_throttles.window_started_at<CURRENT_TIMESTAMP-INTERVAL '15 minutes' THEN 1 ELSE authentication_throttles.failure_count+1 END,
 window_started_at=CASE WHEN authentication_throttles.window_started_at<CURRENT_TIMESTAMP-INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP ELSE authentication_throttles.window_started_at END,
 blocked_until=CASE WHEN (CASE WHEN authentication_throttles.window_started_at<CURRENT_TIMESTAMP-INTERVAL '15 minutes' THEN 1 ELSE authentication_throttles.failure_count+1 END)>=5
 THEN CURRENT_TIMESTAMP+(LEAST(30,POWER(2,LEAST(authentication_throttles.failure_count,5)))||' minutes')::interval ELSE authentication_throttles.blocked_until END,
 updated_at=CURRENT_TIMESTAMP`,[key]);};
const success=async(input,database=pool)=>database.query('DELETE FROM authentication_throttles WHERE throttle_key=$1',[keyFor(input)]);
module.exports={keyFor,assertAllowed,failure,success};
