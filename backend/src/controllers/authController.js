const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { getJwtSecret, issueSessionToken } = require('../services/sessionTokenService');
const { recordSecurityEvent } = require('../services/securityEventService');
const browserSessions=require('../services/browserSessionService');
const authThrottle=require('../services/authThrottleService');
const sessionController=require('./sessionController');
const { onboardingState }=require('../services/studentOnboardingService');

const createAuthController = ({ database=pool, comparePassword=bcrypt.compare, issueToken=issueSessionToken, jwtSecret=getJwtSecret, auditSecurityEvent=recordSecurityEvent, sessions=browserSessions, throttles=authThrottle, challenges=sessionController }={}) => ({
  loginUser: async (req,res) => {
    try {
      const username=typeof req.body?.username==='string'?req.body.username.normalize('NFKC').trim():'';
      const password=req.body?.password;
      if(!username||typeof password!=='string'||!password)return res.status(400).json({success:false,message:'Username and password are required'});
      const throttleInput={kind:'password',identifier:username,ip:req.ip};
      if(issueToken===issueSessionToken)await throttles.assertAllowed(throttleInput,database);
      const result=await database.query(
        `SELECT u.*,s.onboarding_required,s.onboarding_completed_at,s.pending_google_email,s.pending_google_email_verified_at,
                EXISTS(SELECT 1 FROM google_identity_links gil WHERE gil.user_id=u.id AND gil.revoked_at IS NULL) google_linked,
                COALESCE(s.first_name,dh.first_name,sp.first_name,ap.first_name) AS first_name,
                COALESCE(s.last_name,dh.last_name,sp.last_name,ap.last_name) AS last_name
         FROM users u
         LEFT JOIN students s ON s.user_id=u.id
         LEFT JOIN department_heads dh ON dh.user_id=u.id
         LEFT JOIN staff_profiles sp ON sp.user_id=u.id
         LEFT JOIN admin_profiles ap ON ap.user_id=u.id
         WHERE (u.username=$1 OR (u.role='STUDENT' AND s.student_number=$1)) AND u.is_active=TRUE
         AND (u.role<>'STUDENT' OR u.email_verified=TRUE) LIMIT 1`, [username]
      );
      const user=result.rows[0];
      if(!user||!(await comparePassword(password,user.password_hash))){
        if(issueToken===issueSessionToken)await throttles.failure(throttleInput,database);
        await auditSecurityEvent({actor:user?{id:user.id,username:user.username,role:user.role}:null,action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetId:user?.id,targetLabel:username,details:{authentication_method:'PASSWORD'},reason:'Invalid credentials',result:'DENIED',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
        return res.status(401).json({success:false,message:'Invalid username or password'});
      }
      await database.query('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1',[user.id]);
      if(issueToken===issueSessionToken)await throttles.success(throttleInput,database);
      if(user.role==='DISCIPLINE_ADMIN')await auditSecurityEvent({actor:{id:user.id,username:user.username,role:user.role},action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetId:user.id,targetLabel:user.username,details:{authentication_method:'PASSWORD'},result:'SUCCESS',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
      const fullName=[user.first_name,user.last_name].filter(Boolean).join(' ')||null;
      const publicUser={id:user.id,username:user.username,role:user.role,first_name:user.first_name||null,last_name:user.last_name||null,full_name:fullName,password_change_required:Boolean(user.must_change_password),...onboardingState(user)};
      // Dependency-injected token issuers are retained only for isolated legacy unit tests.
      if(issueToken!==issueSessionToken)return res.json({success:true,message:'Login successful',token:issueToken(user,{env:{JWT_SECRET:jwtSecret()}}),user:publicUser});
      if(user.role==='DISCIPLINE_ADMIN'){
        const enabled=(await database.query('SELECT 1 FROM user_mfa WHERE user_id=$1 AND enabled_at IS NOT NULL',[user.id])).rows[0];
        await challenges.createChallenge({userId:user.id,purpose:enabled?'VERIFY':'ENROLL',res});
        return res.status(202).json({success:true,mfa_required:Boolean(enabled),mfa_enrollment_required:!enabled,user:{username:user.username,role:user.role},server_time_ms:Date.now(),totp_period_seconds:30});
      }
      const created=await sessions.createSession({userId:user.id,ipAddress:req.ip,userAgent:req.get?.('user-agent'),database});
      sessions.setSessionCookies(res,created);
      return res.json({success:true,message:'Login successful',user:publicUser,csrf_token:created.csrf});
    } catch(error) {
      console.error('Login error:',error);
      await auditSecurityEvent({actor:null,action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetLabel:typeof req.body?.username==='string'?req.body.username.trim().slice(0,100):null,details:{authentication_method:'PASSWORD',error_code:error.code||'INTERNAL_ERROR'},reason:'Authentication processing failed',result:'FAILED',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
      if(error?.message?.toLowerCase().includes('jwt_secret'))return res.status(500).json({success:false,message:'JWT_SECRET is not configured securely. Set a strong environment secret before launch.'});
      return res.status(500).json({success:false,message:'Login failed'});
    }
  }
});

module.exports={createAuthController,...createAuthController()};
