const crypto = require('node:crypto');
const pool = require('../config/database');

const COOKIE_NAME = 'sti_session';
const PREAUTH_COOKIE = 'sti_preauth';
const CSRF_COOKIE = 'sti_csrf';
const keyFor=(name)=>process.env[name]||(process.env.NODE_ENV==='production'?'':process.env.JWT_SECRET)||`development-only-${name}-key-change-me`;
const hash = (value, key = keyFor('SESSION_HASH_KEY')) => crypto.createHmac('sha256', key).update(String(value)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const parseCookies = (header = '') => Object.fromEntries(String(header).split(';').map(v => v.trim()).filter(Boolean).map(v => {
  const at=v.indexOf('='); return at<0?[v,'']:[v.slice(0,at),decodeURIComponent(v.slice(at+1))];
}));
const cookieOptions = (maxAge) => ({ httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge });
const appendCookie = (res, name, value, options={}) => {
  const sameSite=String(options.sameSite||'Lax');
  const parts=[`${name}=${encodeURIComponent(value)}`,`Path=${options.path||'/'}`,`SameSite=${sameSite.charAt(0).toUpperCase()+sameSite.slice(1).toLowerCase()}`];
  if(options.httpOnly)parts.push('HttpOnly'); if(options.secure)parts.push('Secure'); if(options.maxAge!==undefined)parts.push(`Max-Age=${Math.max(0,Math.floor(options.maxAge/1000))}`);
  res.append('Set-Cookie',parts.join('; '));
};
const clearCookie=(res,name)=>appendCookie(res,name,'',{...cookieOptions(0),maxAge:0});
const publicUser=(row)=>({id:Number(row.id),username:row.username,role:row.role,first_name:row.first_name||null,last_name:row.last_name||null,full_name:[row.first_name,row.last_name].filter(Boolean).join(' ')||null,password_change_required:Boolean(row.must_change_password)});

const createSession = async ({userId,ipAddress,userAgent,database=pool}) => {
  const token=randomToken(),csrf=randomToken();
  const privileged=(await database.query('SELECT role FROM users WHERE id=$1',[Number(userId)])).rows[0]?.role;
  const idleMinutes=privileged==='DISCIPLINE_ADMIN'?30:120;
  const result=await database.query(`INSERT INTO browser_sessions(user_id,token_hash,csrf_hash,idle_expires_at,absolute_expires_at,ip_address,user_agent)
    VALUES($1,$2,$3,CURRENT_TIMESTAMP+($4||' minutes')::interval,CURRENT_TIMESTAMP+INTERVAL '8 hours',$5,$6) RETURNING absolute_expires_at`,
    [Number(userId),hash(token),hash(csrf,process.env.CSRF_SIGNING_KEY),idleMinutes,ipAddress||null,String(userAgent||'').slice(0,500)||null]);
  return {token,csrf,expiresAt:result.rows[0].absolute_expires_at};
};
const setSessionCookies=(res,created)=>{appendCookie(res,COOKIE_NAME,created.token,cookieOptions(8*60*60*1000));appendCookie(res,CSRF_COOKIE,created.csrf,{...cookieOptions(8*60*60*1000),httpOnly:false});clearCookie(res,PREAUTH_COOKIE);};
const revokeFromRequest=async(req,database=pool)=>{const token=parseCookies(req.headers.cookie)[COOKIE_NAME];if(token)await database.query('UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=$1 AND revoked_at IS NULL',[hash(token)]);};
const revokeUserSessions=(userId,database=pool)=>database.query('UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND revoked_at IS NULL',[Number(userId)]);
const clearSessionCookies=(res)=>{clearCookie(res,COOKIE_NAME);clearCookie(res,PREAUTH_COOKIE);clearCookie(res,CSRF_COOKIE);};

module.exports={COOKIE_NAME,PREAUTH_COOKIE,CSRF_COOKIE,hash,randomToken,parseCookies,cookieOptions,appendCookie,clearCookie,publicUser,createSession,setSessionCookies,revokeFromRequest,revokeUserSessions,clearSessionCookies};
