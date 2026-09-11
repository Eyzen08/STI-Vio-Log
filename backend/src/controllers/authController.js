const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { getJwtSecret, issueSessionToken } = require('../services/sessionTokenService');
const { recordSecurityEvent } = require('../services/securityEventService');

const createAuthController = ({ database=pool, comparePassword=bcrypt.compare, issueToken=issueSessionToken, jwtSecret=getJwtSecret, auditSecurityEvent=recordSecurityEvent }={}) => ({
  loginUser: async (req,res) => {
    try {
      const username=typeof req.body?.username==='string'?req.body.username.normalize('NFKC').trim():'';
      const password=req.body?.password;
      if(!username||typeof password!=='string'||!password)return res.status(400).json({success:false,message:'Username and password are required'});
      const result=await database.query(
        `SELECT u.*,COALESCE(s.first_name,dh.first_name,sp.first_name,ap.first_name) AS first_name,
                COALESCE(s.last_name,dh.last_name,sp.last_name,ap.last_name) AS last_name
         FROM users u
         LEFT JOIN students s ON s.user_id=u.id
         LEFT JOIN department_heads dh ON dh.user_id=u.id
         LEFT JOIN staff_profiles sp ON sp.user_id=u.id
         LEFT JOIN admin_profiles ap ON ap.user_id=u.id
         WHERE u.username=$1 AND u.is_active=TRUE
         AND (u.role<>'STUDENT' OR u.email_verified=TRUE) LIMIT 1`, [username]
      );
      const user=result.rows[0];
      if(!user||!(await comparePassword(password,user.password_hash))){
        await auditSecurityEvent({actor:user?{id:user.id,username:user.username,role:user.role}:null,action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetId:user?.id,targetLabel:username,details:{authentication_method:'PASSWORD'},reason:'Invalid credentials',result:'DENIED',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
        return res.status(401).json({success:false,message:'Invalid username or password'});
      }
      await database.query('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1',[user.id]);
      const token=issueToken(user,{env:{JWT_SECRET:jwtSecret()}});
      if(['SYSTEM_ADMIN','DISCIPLINE_ADMIN'].includes(user.role))await auditSecurityEvent({actor:{id:user.id,username:user.username,role:user.role},action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetId:user.id,targetLabel:user.username,details:{authentication_method:'PASSWORD'},result:'SUCCESS',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
      const fullName=[user.first_name,user.last_name].filter(Boolean).join(' ')||null;
      return res.json({success:true,message:'Login successful',token,user:{id:user.id,username:user.username,role:user.role,first_name:user.first_name||null,last_name:user.last_name||null,full_name:fullName,password_change_required:Boolean(user.must_change_password)}});
    } catch(error) {
      console.error('Login error:',error);
      await auditSecurityEvent({actor:null,action:'LOGIN_PASSWORD',targetType:'USER_ACCOUNT',targetLabel:typeof req.body?.username==='string'?req.body.username.trim().slice(0,100):null,details:{authentication_method:'PASSWORD',error_code:error.code||'INTERNAL_ERROR'},reason:'Authentication processing failed',result:'FAILED',ipAddress:req.ip,userAgent:req.get?.('user-agent'),requestId:req.requestId,database});
      if(error?.message?.toLowerCase().includes('jwt_secret'))return res.status(500).json({success:false,message:'JWT_SECRET is not configured securely. Set a strong environment secret before launch.'});
      return res.status(500).json({success:false,message:'Login failed'});
    }
  }
});

module.exports={createAuthController,...createAuthController()};
