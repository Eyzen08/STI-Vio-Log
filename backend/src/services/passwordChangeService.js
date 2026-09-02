const bcrypt = require('bcrypt');
const { ApiError } = require('../utils/api');
const { issueSessionToken } = require('./sessionTokenService');
const { passwordIsStrong } = require('./passwordPolicy');

const createPasswordChangeService = ({ pool, comparePassword = bcrypt.compare, hashPassword = (value) => bcrypt.hash(value, 12), issueToken = issueSessionToken } = {}) => {
  if (!pool?.connect) throw new TypeError('Password change dependencies are required');
  const change = async ({ userId, currentPassword, newPassword, ipAddress = null }) => {
    if (!Number.isInteger(Number(userId)) || Number(userId) < 1 || typeof currentPassword !== 'string' || !passwordIsStrong(newPassword)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Use an 8-128 character password with uppercase, number, and symbol');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = (await client.query('SELECT id,username,role,password_hash,session_version FROM users WHERE id=$1 AND is_active=TRUE FOR UPDATE', [Number(userId)])).rows[0];
      if (!user || !(await comparePassword(currentPassword,user.password_hash))) throw new ApiError(401,'INVALID_CREDENTIALS','Current password is incorrect');
      if (await comparePassword(newPassword,user.password_hash)) throw new ApiError(409,'PASSWORD_REUSE','New password must be different from the current password');
      const passwordHash = await hashPassword(newPassword);
      const updated = (await client.query(
        `UPDATE users SET password_hash=$2, must_change_password=FALSE, password_changed_at=CURRENT_TIMESTAMP,
         session_version=session_version+1, updated_at=CURRENT_TIMESTAMP WHERE id=$1
         RETURNING id,username,role,session_version,must_change_password`, [user.id,passwordHash]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs (user_id,action,table_name,record_id,description,ip_address)
         VALUES ($1,'ACCOUNT_PASSWORD_CHANGE','users',$1,'Account password changed and existing sessions invalidated',$2)`, [user.id,ipAddress]
      );
      await client.query('COMMIT');
      return { token:issueToken(updated), user:{id:Number(updated.id),username:updated.username,role:updated.role,password_change_required:false} };
    } catch(error) { try{await client.query('ROLLBACK');}catch(_){} throw error; }
    finally{client.release();}
  };
  return { change };
};
module.exports = { createPasswordChangeService, passwordIsStrong };
