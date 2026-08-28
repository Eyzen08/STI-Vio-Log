const { ApiError } = require('../utils/api');
const { isValidStudentNumber } = require('../utils/validators');
const { issueSessionToken } = require('./sessionTokenService');

const LINK_FAILURE = 'Unable to link this student account';
const LOGIN_FAILURE = 'Google account is not linked to an active student account';
const REGISTRATION_PENDING = 'Student registration submitted for enrollment verification';

const normalizeName = (value) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
  : '';

const publicUser = (row) => ({ id: Number(row.id), username: row.username, role: row.role });
const sessionResult = (row, issueToken) => ({ token: issueToken(row), user: publicUser(row) });

const createGoogleIdentityService = ({ pool, verifyIdentity, issueToken = issueSessionToken }) => {
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
        `SELECT u.id, u.username, u.role, s.first_name, s.last_name
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.student_number = $1 AND u.role = 'STUDENT' AND u.is_active = TRUE
         FOR UPDATE`,
        [studentNumber.trim()]
      );
      const account = result.rows[0];
      matchedUserId = account?.id || null;
      if (account && (normalizeName(account.first_name) !== normalizeName(firstName) || normalizeName(account.last_name) !== normalizeName(lastName))) {
        throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);
      }
      if (!account) {
        const occupied = (await client.query(
          `SELECT 1 FROM students WHERE student_number = $1
          UNION ALL SELECT 1 FROM google_identity_links WHERE google_subject = $2
          UNION ALL SELECT 1 FROM google_department_registrations WHERE google_subject = $2 AND status = 'PENDING'
           LIMIT 1`,
          [studentNumber.trim(), identity.subject]
        )).rows[0];
        if (occupied) throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);

        const existing = (await client.query(
          `SELECT id, google_subject, student_number, first_name, last_name
           FROM google_student_registrations
           WHERE status = 'PENDING' AND (google_subject = $1 OR student_number = $2)
           FOR UPDATE`,
          [identity.subject, studentNumber.trim()]
        )).rows;
        const sameRequest = existing.find((row) =>
          row.google_subject === identity.subject
          && row.student_number === studentNumber.trim()
          && normalizeName(row.first_name) === normalizeName(firstName)
          && normalizeName(row.last_name) === normalizeName(lastName)
        );
        if (sameRequest && existing.length === 1) {
          await client.query('COMMIT');
          return { pending: true, message: REGISTRATION_PENDING, registration: { id: Number(sameRequest.id), status: 'PENDING' } };
        }
        if (existing.length) throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);

        // The pending-row lock above may have waited for an approval to
        // commit. Recheck cross-table ownership in the now-current snapshot
        // before creating a new pending request.
        const newlyOccupied = (await client.query(
          `SELECT 1 FROM students WHERE student_number = $1
           UNION ALL SELECT 1 FROM google_identity_links WHERE google_subject = $2
           UNION ALL SELECT 1 FROM google_department_registrations WHERE google_subject = $2 AND status = 'PENDING'
           LIMIT 1`,
          [studentNumber.trim(), identity.subject]
        )).rows[0];
        if (newlyOccupied) throw new ApiError(409, 'STUDENT_LINK_UNAVAILABLE', LINK_FAILURE);

        const registration = (await client.query(
          `INSERT INTO google_student_registrations
             (google_subject, google_email, student_number, first_name, last_name)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [identity.subject, identity.emailVerified ? identity.email : null, studentNumber.trim(), firstName.trim(), lastName.trim()]
        )).rows[0];
        await client.query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
           VALUES (NULL, 'GOOGLE_REGISTRATION_SUBMITTED', 'google_student_registrations', $1,
                   'Google student registration submitted for enrollment verification', $2)`,
          [registration.id, ipAddress]
        );
        await client.query('COMMIT');
        return { pending: true, message: REGISTRATION_PENDING, registration: { id: Number(registration.id), status: 'PENDING' } };
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT u.id, u.username, u.role, gil.id AS link_id
         FROM google_identity_links gil JOIN users u ON u.id = gil.user_id
         WHERE gil.google_subject = $1 AND u.role = 'STUDENT' AND u.is_active = TRUE
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
      return sessionResult(account, issueToken);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
  };

  return { linkStudent, loginStudent };
};

module.exports = { createGoogleIdentityService, normalizeName, LINK_FAILURE, LOGIN_FAILURE, REGISTRATION_PENDING };
