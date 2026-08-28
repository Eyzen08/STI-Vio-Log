const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');

const FAILURE = 'Unable to review this department registration';
const STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const publicRegistration = (row) => ({
  id: Number(row.id), google_email: row.google_email, officer_first_name: row.officer_first_name,
  officer_last_name: row.officer_last_name, employee_number: row.employee_number || null,
  requested_department_type: row.requested_department_type, requested_department_name: row.requested_department_name,
  applicant_note: row.applicant_note || null, status: row.status, assigned_department_id: row.assigned_department_id ? Number(row.assigned_department_id) : null,
  review_reason: row.review_reason || null, reviewed_at: row.reviewed_at || null, created_at: row.created_at
});

const createGoogleDepartmentRegistrationService = ({ pool, hashPassword = (value) => bcrypt.hash(value, 12), randomBytes = crypto.randomBytes } = {}) => {
  if (!pool?.connect) throw new TypeError('Google department registration dependencies are required');

  const list = async ({ status = 'PENDING', limit = 50 } = {}) => {
    const normalizedStatus = String(status).trim().toUpperCase();
    const parsedLimit = Number(limit);
    if (!STATUSES.has(normalizedStatus) || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid registration status or limit');
    }
    const registrations = await pool.query(
      `SELECT id, google_email, officer_first_name, officer_last_name, employee_number,
              requested_department_type, requested_department_name, applicant_note, status,
              assigned_department_id, review_reason, reviewed_at, created_at
       FROM google_department_registrations WHERE status = $1 ORDER BY created_at, id LIMIT $2`,
      [normalizedStatus, parsedLimit]
    );
    const departments = await pool.query('SELECT id, department_name FROM departments WHERE is_active = TRUE ORDER BY department_name, id');
    return { registrations: registrations.rows.map(publicRegistration), departments: departments.rows.map((row) => ({ id: Number(row.id), department_name: row.department_name })) };
  };

  const review = async ({ registrationId, reviewerId, decision, reason, departmentId }) => {
    const normalizedDecision = String(decision).trim().toUpperCase();
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!isPositiveId(registrationId) || !isPositiveId(reviewerId) || !['APPROVED', 'REJECTED'].includes(normalizedDecision)
      || !normalizedReason || normalizedReason.length > 1000 || (normalizedDecision === 'APPROVED' && !isPositiveId(departmentId))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A valid decision, reason, and approval department are required');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const registration = (await client.query('SELECT * FROM google_department_registrations WHERE id = $1 FOR UPDATE', [Number(registrationId)])).rows[0];
      if (!registration || registration.status !== 'PENDING') throw new ApiError(409, 'REGISTRATION_NOT_PENDING', FAILURE);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-identity:${registration.google_subject}`]);

      if (normalizedDecision === 'REJECTED') {
        const row = (await client.query(
          `UPDATE google_department_registrations SET status='REJECTED', review_reason=$2, reviewed_by=$3,
           reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
          [registration.id, normalizedReason, Number(reviewerId)]
        )).rows[0];
        await client.query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, description)
           VALUES ($1,'GOOGLE_DEPARTMENT_REGISTRATION_REJECTED','google_department_registrations',$2,$3)`,
          [Number(reviewerId), registration.id, `Department registration rejected: ${normalizedReason}`]
        );
        await client.query('COMMIT');
        return publicRegistration(row);
      }

      const department = (await client.query('SELECT id FROM departments WHERE id=$1 AND is_active=TRUE FOR UPDATE', [Number(departmentId)])).rows[0];
      if (!department) throw new ApiError(400, 'VALIDATION_ERROR', 'Select an active department');
      const baseUsername = registration.employee_number || `department-${registration.id}`;
      const conflict = (await client.query(
        `SELECT 1 FROM users WHERE username=$1
         UNION ALL SELECT 1 FROM google_identity_links WHERE google_subject=$2
         UNION ALL SELECT 1 FROM department_heads WHERE employee_number IS NOT NULL AND employee_number=$3 LIMIT 1`,
        [baseUsername, registration.google_subject, registration.employee_number]
      )).rows[0];
      if (conflict) throw new ApiError(409, 'REGISTRATION_CONFLICT', FAILURE);
      const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
      const user = (await client.query(
        `INSERT INTO users (username,password_hash,role,is_active) VALUES ($1,$2,'DEPARTMENT_HEAD',TRUE) RETURNING id,username`,
        [baseUsername, passwordHash]
      )).rows[0];
      await client.query(
        `INSERT INTO department_heads (user_id,department_id,employee_number,first_name,last_name,email,qr_scanner_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [user.id, department.id, registration.employee_number, registration.officer_first_name, registration.officer_last_name, registration.google_email]
      );
      const link = (await client.query(
        `INSERT INTO google_identity_links (user_id,google_subject,google_email) VALUES ($1,$2,$3) RETURNING id`,
        [user.id, registration.google_subject, registration.google_email]
      )).rows[0];
      const row = (await client.query(
        `UPDATE google_department_registrations SET status='APPROVED', assigned_department_id=$2,
         review_reason=$3, reviewed_by=$4, reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [registration.id, department.id, normalizedReason, Number(reviewerId)]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs (user_id,action,table_name,record_id,description) VALUES
         ($1,'GOOGLE_DEPARTMENT_REGISTRATION_APPROVED','google_department_registrations',$2,$3),
         ($1,'GOOGLE_LINK','google_identity_links',$4,'Google identity linked after department approval')`,
        [Number(reviewerId), registration.id, `Department registration approved: ${normalizedReason}`, link.id]
      );
      await client.query('COMMIT');
      return publicRegistration(row);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'REGISTRATION_CONFLICT', FAILURE);
      throw error;
    } finally { client.release(); }
  };
  return { list, review };
};

module.exports = { createGoogleDepartmentRegistrationService, publicRegistration, FAILURE };
