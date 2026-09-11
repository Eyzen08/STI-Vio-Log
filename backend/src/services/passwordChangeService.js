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
      const user = (await client.query(`SELECT u.id,u.username,u.role,u.password_hash,u.session_version,
        COALESCE(s.first_name,dh.first_name,sp.first_name,ap.first_name) AS first_name,
        COALESCE(s.last_name,dh.last_name,sp.last_name,ap.last_name) AS last_name
        FROM users u LEFT JOIN students s ON s.user_id=u.id LEFT JOIN department_heads dh ON dh.user_id=u.id
        LEFT JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN admin_profiles ap ON ap.user_id=u.id
        WHERE u.id=$1 AND u.is_active=TRUE FOR UPDATE OF u`, [Number(userId)])).rows[0];
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
      const firstName=user.first_name||null,lastName=user.last_name||null;
      return { token:issueToken(updated), user:{id:Number(updated.id),username:updated.username,role:updated.role,first_name:firstName,last_name:lastName,full_name:[firstName,lastName].filter(Boolean).join(' ')||null,password_change_required:false} };
    } catch(error) { try{await client.query('ROLLBACK');}catch(_){} throw error; }
    finally{client.release();}
  };
  return { change };
};
module.exports = { createPasswordChangeService, passwordIsStrong };
