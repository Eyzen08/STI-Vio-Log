const { ApiError } = require('../utils/api');
const { issueSessionToken } = require('./sessionTokenService');
const { normalizeName } = require('./googleIdentityService');

const TYPES = new Set(['LIBRARY', 'SCHOOL_GUARD', 'STAFF_OFFICE', 'OTHER']);
const FAILURE = 'Unable to register this department account';
const LOGIN_FAILURE = 'Google account is not linked to an active department account';
const PENDING = 'Department registration submitted for administrator verification';
const clean = (value) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
const publicUser = (row) => ({ id: Number(row.id), username: row.username, role: row.role });

const createGoogleDepartmentIdentityService = ({ pool, verifyIdentity, issueToken = issueSessionToken }) => {
  if (!pool?.connect || typeof verifyIdentity !== 'function') throw new TypeError('Google department identity dependencies are required');

  const register = async ({ credential, firstName, lastName, employeeNumber, departmentType, departmentName, note, ipAddress = null }) => {
    const identity = await verifyIdentity(credential);
    const values = {
      firstName: clean(firstName), lastName: clean(lastName), employeeNumber: clean(employeeNumber) || null,
      departmentType: clean(departmentType).toUpperCase(), departmentName: clean(departmentName), note: clean(note) || null
    };
    if (!identity.emailVerified || !identity.email || !values.firstName || !values.lastName || !values.departmentName || !TYPES.has(values.departmentType)
      || values.firstName.length > 100 || values.lastName.length > 100 || values.departmentName.length > 150
      || (values.employeeNumber && values.employeeNumber.length > 50) || (values.note && values.note.length > 1000)) {
      throw new ApiError(400, 'VALIDATION_ERROR', FAILURE);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-identity:${identity.subject}`]);
      const occupied = (await client.query(
        `SELECT 'LINK' AS source FROM google_identity_links WHERE google_subject = $1
         UNION ALL SELECT 'STUDENT' FROM google_student_registrations WHERE google_subject = $1 AND status = 'PENDING'
         LIMIT 1`, [identity.subject]
      )).rows[0];
      if (occupied) throw new ApiError(409, 'DEPARTMENT_REGISTRATION_UNAVAILABLE', FAILURE);
      const existing = (await client.query(
        `SELECT * FROM google_department_registrations WHERE google_subject = $1 AND status = 'PENDING' FOR UPDATE`,
        [identity.subject]
      )).rows[0];
      if (existing) {
        const same = normalizeName(existing.officer_first_name) === normalizeName(values.firstName)
          && normalizeName(existing.officer_last_name) === normalizeName(values.lastName)
          && (existing.employee_number || null) === values.employeeNumber
          && existing.requested_department_type === values.departmentType
          && normalizeName(existing.requested_department_name) === normalizeName(values.departmentName);
        if (!same) throw new ApiError(409, 'DEPARTMENT_REGISTRATION_UNAVAILABLE', FAILURE);
        await client.query('COMMIT');
        return { pending: true, message: PENDING, registration: { id: Number(existing.id), status: 'PENDING' } };
      }
      if (values.employeeNumber) {
        const employeeConflict = (await client.query(
          `SELECT 1 FROM department_heads WHERE employee_number = $1
           UNION ALL SELECT 1 FROM google_department_registrations WHERE employee_number = $1 AND status = 'PENDING' LIMIT 1`,
          [values.employeeNumber]
        )).rows[0];
        if (employeeConflict) throw new ApiError(409, 'DEPARTMENT_REGISTRATION_UNAVAILABLE', FAILURE);
      }
      const registration = (await client.query(
        `INSERT INTO google_department_registrations
          (google_subject, google_email, officer_first_name, officer_last_name, employee_number,
           requested_department_type, requested_department_name, applicant_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [identity.subject, identity.email, values.firstName, values.lastName, values.employeeNumber, values.departmentType, values.departmentName, values.note]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES (NULL, 'GOOGLE_DEPARTMENT_REGISTRATION_SUBMITTED', 'google_department_registrations', $1,
                 'Google department officer registration submitted for administrator verification', $2)`,
        [registration.id, ipAddress]
      );
      await client.query('COMMIT');
      return { pending: true, message: PENDING, registration: { id: Number(registration.id), status: 'PENDING' } };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'DEPARTMENT_REGISTRATION_UNAVAILABLE', FAILURE);
      throw error;
    } finally { client.release(); }
  };

  const login = async ({ credential, ipAddress = null }) => {
    const identity = await verifyIdentity(credential);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const account = (await client.query(
        `SELECT u.id, u.username, u.role, gil.id AS link_id
         FROM google_identity_links gil
         JOIN users u ON u.id = gil.user_id
         JOIN department_heads dh ON dh.user_id = u.id
         JOIN departments d ON d.id = dh.department_id
         WHERE gil.google_subject = $1 AND u.role = 'DEPARTMENT_HEAD'
           AND u.is_active = TRUE AND d.is_active = TRUE FOR UPDATE OF gil`,
        [identity.subject]
      )).rows[0];
      if (!account) throw new ApiError(401, 'GOOGLE_DEPARTMENT_LOGIN_FAILED', LOGIN_FAILURE);
      await client.query('UPDATE google_identity_links SET google_email = $1, last_login_at = CURRENT_TIMESTAMP WHERE id = $2', [identity.email, account.link_id]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'GOOGLE_DEPARTMENT_LOGIN', 'google_identity_links', $2, 'Department officer signed in with linked Google identity', $3)`,
        [account.id, account.link_id, ipAddress]
      );
      await client.query('COMMIT');
      return { token: issueToken(account), user: publicUser(account) };
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  return { register, login };
};

module.exports = { createGoogleDepartmentIdentityService, TYPES, FAILURE, LOGIN_FAILURE, PENDING };
