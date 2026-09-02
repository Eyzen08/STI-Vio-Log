const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { getJwtSecret, issueSessionToken } = require('../services/sessionTokenService');

const createAuthController = ({ database=pool, comparePassword=bcrypt.compare, issueToken=issueSessionToken, jwtSecret=getJwtSecret }={}) => ({
  loginUser: async (req,res) => {
    try {
      const username=typeof req.body?.username==='string'?req.body.username.normalize('NFKC').trim():'';
      const password=req.body?.password;
      if(!username||typeof password!=='string'||!password)return res.status(400).json({success:false,message:'Username and password are required'});
      const result=await database.query(
        `SELECT * FROM users WHERE username=$1 AND is_active=TRUE
         AND (role<>'STUDENT' OR email_verified=TRUE) LIMIT 1`, [username]
      );
      const user=result.rows[0];
      if(!user||!(await comparePassword(password,user.password_hash)))return res.status(401).json({success:false,message:'Invalid username or password'});
      const token=issueToken(user,{env:{JWT_SECRET:jwtSecret()}});
      return res.json({success:true,message:'Login successful',token,user:{id:user.id,username:user.username,role:user.role,password_change_required:Boolean(user.must_change_password)}});
    } catch(error) {
      console.error('Login error:',error);
      if(error?.message?.toLowerCase().includes('jwt_secret'))return res.status(500).json({success:false,message:'JWT_SECRET is not configured securely. Set a strong environment secret before launch.'});
      return res.status(500).json({success:false,message:'Login failed'});
    }
  }
});

module.exports={createAuthController,...createAuthController()};
