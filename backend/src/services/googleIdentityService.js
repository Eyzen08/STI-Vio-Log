const { avatarSql, avatarMetadata } = require('./avatarService');
const { ApiError } = require('../utils/api');
const { issueSessionToken } = require('./sessionTokenService');
const { onboardingState } = require('./studentOnboardingService');
const { recordSecurityEvent } = require('./securityEventService');

const LINK_FAILURE = 'Unable to link this student account';
const LOGIN_FAILURE = 'Google account is not linked to an active student account';

const publicUser = (row) => ({
  id: Number(row.id), avatar: row.avatar || avatarMetadata(row), username: row.username, role: row.role,
  first_name: row.first_name || null, last_name: row.last_name || null,
  full_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
  password_change_required: Boolean(row.must_change_password), ...onboardingState(row)
});
const sessionResult = (row, issueToken) => ({ token: issueToken(row), user: publicUser(row) });

const createGoogleIdentityService = ({ pool, verifyIdentity, issueToken = issueSessionToken, authThrottle = null, createSession = null }) => {
  if (!pool || typeof pool.connect !== 'function' || typeof verifyIdentity !== 'function') throw new TypeError('Google identity service dependencies are required');

  const loginStudent = async ({ credential, ipAddress = null, userAgent = null }) => {
    const identity = await verifyIdentity(credential);
    const throttleInput = { kind:'google', identifier:identity.subject, ip:ipAddress };
    if (authThrottle) await authThrottle.assertAllowed(throttleInput, pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT ${avatarSql('u.id')} AS avatar,u.id, u.username, u.role, u.session_version, u.must_change_password,
                u.temporary_password_expires_at,s.email,s.google_rebind_required,s.onboarding_required,s.onboarding_completed_at,TRUE google_linked,
                s.first_name, s.last_name, gil.id AS link_id
         FROM google_identity_links gil JOIN users u ON u.id = gil.user_id
         JOIN students s ON s.user_id = u.id
         WHERE gil.google_subject = $1 AND gil.revoked_at IS NULL AND u.role = 'STUDENT' AND u.is_active = TRUE
         FOR UPDATE OF gil,u`,
        [identity.subject]
      );
      const account = result.rows[0];
      if (!account) throw new ApiError(401, 'GOOGLE_LOGIN_FAILED', LOGIN_FAILURE);
      if (account.must_change_password && (!account.temporary_password_expires_at || new Date(account.temporary_password_expires_at)<=new Date())) throw new ApiError(401,'GOOGLE_LOGIN_FAILED','Temporary password expired. Use password recovery or contact the Discipline Office');
      await client.query('UPDATE google_identity_links SET google_email = $1, last_login_at = CURRENT_TIMESTAMP WHERE id = $2', [identity.email, account.link_id]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'GOOGLE_LOGIN', 'google_identity_links', $2, 'Student signed in with linked Google identity', $3)`,
        [account.id, account.link_id, ipAddress]
      );
      const session = createSession ? await createSession({userId:account.id,ipAddress,userAgent,database:client}) : null;
      await client.query('COMMIT');
      if (authThrottle) await authThrottle.success(throttleInput, pool);
      return {...sessionResult(account, issueToken),...(session ? {session} : {})};
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (authThrottle && error.statusCode && error.statusCode < 500) await authThrottle.failure(throttleInput, pool);
      throw error;
    } finally {
      client.release();
    }
  };

  const linkAuthenticatedStudent = async ({ userId, credential, ipAddress = null }) => {
    const identity = await verifyIdentity(credential);
    if (!identity.emailVerified || !identity.email) throw new ApiError(409, 'GOOGLE_EMAIL_UNVERIFIED', 'Choose a Google account with a verified email address');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-identity:${identity.subject}`]);
      const account = (await client.query(
        `SELECT ${avatarSql('u.id')} AS avatar,u.id,u.username,u.role,u.session_version,u.must_change_password,s.id student_id,s.first_name,s.last_name,
                s.email,s.google_rebind_required,s.onboarding_required,s.onboarding_completed_at,s.pending_google_email,s.pending_google_email_verified_at,
                EXISTS(SELECT 1 FROM google_identity_links own WHERE own.user_id=u.id AND own.revoked_at IS NULL) google_linked
         FROM users u JOIN students s ON s.user_id=u.id
         WHERE u.id=$1 AND u.role='STUDENT' AND u.is_active=TRUE FOR UPDATE OF u,s`, [Number(userId)]
      )).rows[0];
      if (!account) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
      if (account.must_change_password) throw new ApiError(409, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before binding Google');
      if (!account.google_rebind_required && (!account.onboarding_required || account.onboarding_completed_at)) throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETE', 'Student onboarding is already complete');
      if (!account.pending_google_email || !account.pending_google_email_verified_at) throw new ApiError(409, 'GOOGLE_EMAIL_CONFIRMATION_REQUIRED', 'Verify your Google account email before continuing');
      if (String(identity.email).trim().toLowerCase() !== String(account.pending_google_email).trim().toLowerCase() || String(identity.email).trim().toLowerCase() !== String(account.email || '').trim().toLowerCase()) throw new ApiError(409, 'GOOGLE_EMAIL_MISMATCH', 'Sign in with the Gmail recorded by the Discipline Office');
      const existing = (await client.query('SELECT id,user_id,google_subject FROM google_identity_links WHERE revoked_at IS NULL AND (user_id=$1 OR google_subject=$2) FOR UPDATE', [account.id,identity.subject])).rows;
      if (existing.some((row) => Number(row.user_id) !== Number(account.id) || row.google_subject !== identity.subject)) throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      let linkId = existing[0]?.id;
      if (linkId) await client.query('UPDATE google_identity_links SET google_email=$2,last_login_at=CURRENT_TIMESTAMP WHERE id=$1', [linkId,identity.email]);
      else linkId = (await client.query('INSERT INTO google_identity_links(user_id,google_subject,google_email) VALUES($1,$2,$3) RETURNING id', [account.id,identity.subject,identity.email])).rows[0].id;
      await client.query('UPDATE students SET email=$2,google_rebind_required=FALSE,pending_google_email=NULL,pending_google_email_verified_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [account.student_id,identity.email]);
      await client.query('UPDATE users SET email_verified=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [account.id]);
      if (!existing.length) await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'GOOGLE_LINK','google_identity_links',$2,'Google identity linked during mandatory student onboarding',$3)`, [account.id,linkId,ipAddress]);
      await client.query('COMMIT');
      return { user:publicUser({...account,google_linked:true,google_rebind_required:false}) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505' || error.code === 'STUDENT_LINK_UNAVAILABLE' || error.code === 'GOOGLE_EMAIL_MISMATCH') await recordSecurityEvent({actor:{id:Number(userId),role:'STUDENT'},action:'STUDENT_GOOGLE_LINK_CONFLICT',targetType:'USER_ACCOUNT',targetId:userId,targetLabel:'Student account',details:{conflict_type:error.code==='GOOGLE_EMAIL_MISMATCH'?'GMAIL':'GOOGLE_IDENTITY'},reason:error.code==='GOOGLE_EMAIL_MISMATCH'?'Google account differs from recorded Gmail':'Google account already linked',result:'DENIED',ipAddress,database:client});
      if (error.code === '23505') throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      throw error;
    } finally { client.release(); }
  };

  return { loginStudent, linkAuthenticatedStudent };
};

module.exports = { createGoogleIdentityService, LINK_FAILURE, LOGIN_FAILURE };
