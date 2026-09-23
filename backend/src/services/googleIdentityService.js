const { ApiError } = require('../utils/api');
const { isValidStudentNumber } = require('../utils/validators');
const { issueSessionToken } = require('./sessionTokenService');
const { onboardingState } = require('./studentOnboardingService');

const LINK_FAILURE = 'Unable to link this student account';
const LOGIN_FAILURE = 'Google account is not linked to an active student account';

const normalizeName = (value) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
  : '';
const namesMatch = (account, firstName, lastName) =>
  normalizeName(`${account?.first_name || ''} ${account?.last_name || ''}`)
  === normalizeName(`${firstName || ''} ${lastName || ''}`);

const publicUser = (row) => ({
  id: Number(row.id), username: row.username, role: row.role,
  first_name: row.first_name || null, last_name: row.last_name || null,
  full_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
  password_change_required: Boolean(row.must_change_password), ...onboardingState(row)
});
const sessionResult = (row, issueToken) => ({ token: issueToken(row), user: publicUser(row) });

const createGoogleIdentityService = ({ pool, verifyIdentity, issueToken = issueSessionToken, authThrottle = null }) => {
  if (!pool || typeof pool.connect !== 'function' || typeof verifyIdentity !== 'function') throw new TypeError('Google identity service dependencies are required');

  const recordRejectedDuplicate = async (executor, userId, ipAddress) => {
    if (!userId) return;
    try {
      await executor.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'GOOGLE_LINK_REJECTED', 'google_identity_links', NULL, 'Duplicate Google identity link attempt rejected', $2)`,
        [userId, ipAddress || null]
      );
    } catch (_) {}
  };

  const linkStudent = async ({ credential, studentNumber, firstName, lastName, ipAddress = null }) => {
    const identity = await verifyIdentity(credential);
    if (!isValidStudentNumber(studentNumber) || !normalizeName(firstName) || !normalizeName(lastName)) {
      throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
    }
    const client = await pool.connect();
    let matchedUserId = null;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-identity:${identity.subject}`]);
      const result = await client.query(
        `SELECT u.id, u.username, u.role, u.session_version, u.must_change_password, s.first_name, s.last_name,
                s.onboarding_required,s.onboarding_completed_at
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.student_number = $1 AND u.role = 'STUDENT' AND u.is_active = TRUE
         FOR UPDATE`,
        [studentNumber.trim()]
      );
      const account = result.rows[0];
      matchedUserId = account?.id || null;
      if (account && !namesMatch(account, firstName, lastName)) {
        throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      }
      if (!account) {
        throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      }
      if (account.onboarding_required && !account.onboarding_completed_at) {
        throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      }
      const link = await client.query(
        `INSERT INTO google_identity_links (user_id, google_subject, google_email)
         VALUES ($1, $2, $3) RETURNING id`,
        [account.id, identity.subject, identity.email]
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'GOOGLE_LINK', 'google_identity_links', $2, 'Google identity linked to student account', $3)`,
        [account.id, link.rows[0].id, ipAddress]
      );
      await client.query('COMMIT');
      return sessionResult(account, issueToken);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') {
        await recordRejectedDuplicate(client, matchedUserId, ipAddress);
        throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      }
      throw error;
    } finally {
      client.release();
    }
  };

  const loginStudent = async ({ credential, ipAddress = null }) => {
    const identity = await verifyIdentity(credential);
    const throttleInput = { kind:'google', identifier:identity.subject, ip:ipAddress };
    if (authThrottle) await authThrottle.assertAllowed(throttleInput, pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT u.id, u.username, u.role, u.session_version, u.must_change_password,
                s.onboarding_required,s.onboarding_completed_at,TRUE google_linked,
                s.first_name, s.last_name, gil.id AS link_id
         FROM google_identity_links gil JOIN users u ON u.id = gil.user_id
         JOIN students s ON s.user_id = u.id
         WHERE gil.google_subject = $1 AND gil.revoked_at IS NULL AND u.role = 'STUDENT' AND u.is_active = TRUE
         FOR UPDATE OF gil`,
        [identity.subject]
      );
      const account = result.rows[0];
      if (!account) throw new ApiError(401, 'GOOGLE_LOGIN_FAILED', LOGIN_FAILURE);
      await client.query('UPDATE google_identity_links SET google_email = $1, last_login_at = CURRENT_TIMESTAMP WHERE id = $2', [identity.email, account.link_id]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'GOOGLE_LOGIN', 'google_identity_links', $2, 'Student signed in with linked Google identity', $3)`,
        [account.id, account.link_id, ipAddress]
      );
      await client.query('COMMIT');
      if (authThrottle) await authThrottle.success(throttleInput, pool);
      return sessionResult(account, issueToken);
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
        `SELECT u.id,u.username,u.role,u.session_version,u.must_change_password,s.id student_id,s.first_name,s.last_name,
                s.onboarding_required,s.onboarding_completed_at,
                EXISTS(SELECT 1 FROM google_identity_links own WHERE own.user_id=u.id AND own.revoked_at IS NULL) google_linked
         FROM users u JOIN students s ON s.user_id=u.id
         WHERE u.id=$1 AND u.role='STUDENT' AND u.is_active=TRUE FOR UPDATE OF u,s`, [Number(userId)]
      )).rows[0];
      if (!account) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
      if (account.must_change_password) throw new ApiError(409, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before binding Google');
      if (!account.onboarding_required || account.onboarding_completed_at) throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETE', 'Student onboarding is already complete');
      const existing = (await client.query('SELECT id,user_id,google_subject FROM google_identity_links WHERE revoked_at IS NULL AND (user_id=$1 OR google_subject=$2) FOR UPDATE', [account.id,identity.subject])).rows;
      if (existing.some((row) => Number(row.user_id) !== Number(account.id) || row.google_subject !== identity.subject)) throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      let linkId = existing[0]?.id;
      if (linkId) await client.query('UPDATE google_identity_links SET google_email=$2,last_login_at=CURRENT_TIMESTAMP WHERE id=$1', [linkId,identity.email]);
      else linkId = (await client.query('INSERT INTO google_identity_links(user_id,google_subject,google_email) VALUES($1,$2,$3) RETURNING id', [account.id,identity.subject,identity.email])).rows[0].id;
      await client.query('UPDATE students SET email=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [account.student_id,identity.email]);
      await client.query('UPDATE users SET email_verified=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [account.id]);
      if (!existing.length) await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'GOOGLE_LINK','google_identity_links',$2,'Google identity linked during mandatory student onboarding',$3)`, [account.id,linkId,ipAddress]);
      await client.query('COMMIT');
      return { user:publicUser({...account,google_linked:true}) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      throw error;
    } finally { client.release(); }
  };

  return { linkStudent, loginStudent, linkAuthenticatedStudent };
};

module.exports = { createGoogleIdentityService, normalizeName, namesMatch, LINK_FAILURE, LOGIN_FAILURE };
