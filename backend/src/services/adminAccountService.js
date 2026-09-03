const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max = 100) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
const publicProfile = (row) => ({ id:Number(row.id), username:row.username, role:row.role, first_name:row.first_name||'', last_name:row.last_name||'', email:row.email||'', email_verified:Boolean(row.email_verified) });

const createAdminAccountService = ({ pool, otpService } = {}) => {
  if (!pool?.connect || !otpService) throw new TypeError('Admin account dependencies are required');
  const getProfile = async ({ userId }) => {
    if (!isPositiveId(userId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid account');
    const row = (await pool.query(`SELECT u.id,u.username,u.role,ap.first_name,ap.last_name,ap.email,ap.email_verified FROM users u LEFT JOIN admin_profiles ap ON ap.user_id=u.id WHERE u.id=$1 AND u.role='ADMIN'`, [Number(userId)])).rows[0];
    if (!row) throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required');
    return publicProfile(row);
  };
  const updateProfile = async ({ userId, firstName, lastName, username, email, ipAddress = null }) => {
    const values = { firstName:clean(firstName), lastName:clean(lastName), username:clean(username).toLowerCase(), email:clean(email,255).toLowerCase() };
    if (!isPositiveId(userId) || !values.firstName || !values.lastName || !values.username || !values.email || !EMAIL_PATTERN.test(values.email)) throw new ApiError(400, 'VALIDATION_ERROR', 'Valid first name, last name, username, and email are required');
    const client = await pool.connect(); let emailChanged = false;
    try {
      await client.query('BEGIN');
      const current = (await client.query(`SELECT u.id,u.username,ap.email FROM users u LEFT JOIN admin_profiles ap ON ap.user_id=u.id WHERE u.id=$1 AND u.role='ADMIN' FOR UPDATE OF u`, [Number(userId)])).rows[0];
      if (!current) throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required');
      const duplicate = (await client.query(`SELECT 1 FROM (SELECT email FROM students UNION ALL SELECT email FROM staff_profiles UNION ALL SELECT email FROM department_heads UNION ALL SELECT email FROM admin_profiles WHERE user_id<>$2) identities WHERE email IS NOT NULL AND LOWER(email)=LOWER($1) LIMIT 1`, [values.email,Number(userId)])).rows[0];
      if (duplicate) throw new ApiError(409, 'ACCOUNT_CONFLICT', 'Username or email is already registered');
      emailChanged = String(current.email||'').toLowerCase() !== values.email;
      await client.query('UPDATE users SET username=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [current.id,values.username]);
      await client.query(`INSERT INTO admin_profiles(user_id,first_name,last_name,email,email_verified) VALUES($1,$2,$3,$4,FALSE) ON CONFLICT(user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,email=EXCLUDED.email,email_verified=CASE WHEN admin_profiles.email=EXCLUDED.email THEN admin_profiles.email_verified ELSE FALSE END,updated_at=CURRENT_TIMESTAMP`, [current.id,values.firstName,values.lastName,values.email]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)VALUES($1,$2,'users',$1,$3,$4)`, [current.id,emailChanged?'ADMIN_EMAIL_CHANGE':'ADMIN_PROFILE_UPDATE',emailChanged?'Administrator profile updated; email verification required':'Administrator profile updated',ipAddress]);
      await client.query('COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} if (error.code === '23505') throw new ApiError(409,'ACCOUNT_CONFLICT','Username or email is already registered'); throw error; }
    finally { client.release(); }
    if (emailChanged) await otpService.issue({ purpose:'ADMIN_EMAIL_VERIFICATION', userId:Number(userId), email:values.email });
    return { profile:await getProfile({userId}), verification_required:emailChanged };
  };
  const resendEmailVerification = async ({ userId }) => {
    const profile = await getProfile({userId});
    if (!profile.email) throw new ApiError(409,'EMAIL_REQUIRED','Register an email address first');
    if (profile.email_verified) throw new ApiError(409,'EMAIL_ALREADY_VERIFIED','Email is already verified');
    await otpService.issue({ purpose:'ADMIN_EMAIL_VERIFICATION', userId:Number(userId), email:profile.email });
    return { message:'A verification code was sent if email delivery is available' };
  };
  const verifyEmail = async ({ userId, code, ipAddress = null }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const account = (await client.query(`SELECT u.id FROM users u JOIN admin_profiles ap ON ap.user_id=u.id WHERE u.id=$1 AND u.role='ADMIN' AND ap.email IS NOT NULL FOR UPDATE OF u`, [Number(userId)])).rows[0];
      if (!account) throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required');
      await otpService.verify({ purpose:'ADMIN_EMAIL_VERIFICATION', userId:Number(userId), code, client });
      await client.query('UPDATE admin_profiles SET email_verified=TRUE,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1', [account.id]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)VALUES($1,'ADMIN_EMAIL_VERIFY','users',$1,'Administrator recovery email verified',$2)`, [account.id,ipAddress]);
      await client.query('COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
    return { profile:await getProfile({userId}) };
  };
  return { getProfile, updateProfile, resendEmailVerification, verifyEmail };
};
module.exports = { createAdminAccountService, EMAIL_PATTERN };
