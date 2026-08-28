const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { isPositiveId, isValidPhone } = require('../utils/validators');

const REVIEW_FAILURE = 'Unable to review this registration';
const VALID_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const publicRegistration = (row) => ({
  id: Number(row.id),
  student_number: row.student_number,
  first_name: row.first_name,
  last_name: row.last_name,
  phone_number: row.phone_number || null,
  program: row.program || null,
  section: row.section || null,
  year_level: row.year_level === null ? null : Number(row.year_level),
  guardian_name: row.guardian_name || null,
  guardian_relationship: row.guardian_relationship || null,
  guardian_phone_number: row.guardian_phone_number || null,
  google_email: row.google_email || null,
  status: row.status,
  review_reason: row.review_reason || null,
  reviewed_at: row.reviewed_at || null,
  created_at: row.created_at
});

const createGoogleRegistrationService = ({ pool, hashPassword = (value) => bcrypt.hash(value, 12), randomBytes = crypto.randomBytes } = {}) => {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('Google registration service dependencies are required');

  const list = async ({ status = 'PENDING', limit = 50 } = {}) => {
    const normalizedStatus = String(status).trim().toUpperCase();
    if (!VALID_STATUSES.has(normalizedStatus)) throw new ApiError(400, 'VALIDATION_ERROR', 'status must be PENDING, APPROVED, or REJECTED');
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) throw new ApiError(400, 'VALIDATION_ERROR', 'limit must be an integer between 1 and 100');
    const safeLimit = parsedLimit;
    const result = await pool.query(
      `SELECT id, student_number, first_name, last_name, google_email, phone_number,
              program, section, year_level, guardian_name, guardian_relationship, guardian_phone_number, status,
              review_reason, reviewed_at, created_at
       FROM google_student_registrations
       WHERE status = $1
       ORDER BY created_at ASC, id ASC
       LIMIT $2`,
      [normalizedStatus, safeLimit]
    );
    return result.rows.map(publicRegistration);
  };

  const review = async ({ registrationId, reviewerId, decision, reason }) => {
    if (!isPositiveId(registrationId) || !isPositiveId(reviewerId)) throw new ApiError(400, 'VALIDATION_ERROR', REVIEW_FAILURE);
    const normalizedDecision = String(decision).trim().toUpperCase();
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!['APPROVED', 'REJECTED'].includes(normalizedDecision) || !normalizedReason || normalizedReason.length > 1000) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A review decision and reason are required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const registration = (await client.query(
        `SELECT id, google_subject, google_email, student_number, first_name, last_name, phone_number,
                program, section, year_level, guardian_name, guardian_relationship, guardian_phone_number, status, created_at
         FROM google_student_registrations WHERE id = $1 FOR UPDATE`,
        [Number(registrationId)]
      )).rows[0];
      if (!registration || registration.status !== 'PENDING') throw new ApiError(409, 'REGISTRATION_NOT_PENDING', REVIEW_FAILURE);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google-identity:${registration.google_subject}`]);

      if (normalizedDecision === 'REJECTED') {
        const reviewed = (await client.query(
          `UPDATE google_student_registrations
           SET status = 'REJECTED', review_reason = $2, reviewed_by = $3,
               reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [registration.id, normalizedReason, Number(reviewerId)]
        )).rows[0];
        await client.query(
          `INSERT INTO audit_logs (user_id, action, table_name, record_id, description)
           VALUES ($1, 'GOOGLE_REGISTRATION_REJECTED', 'google_student_registrations', $2, $3)`,
          [Number(reviewerId), registration.id, `Student registration rejected: ${normalizedReason}`]
        );
        await client.query('COMMIT');
        return publicRegistration(reviewed);
      }

      if (!isValidPhone(registration.phone_number) || !registration.program || !registration.section
        || !Number.isInteger(Number(registration.year_level)) || !registration.guardian_name
        || !registration.guardian_relationship || !isValidPhone(registration.guardian_phone_number)) {
        throw new ApiError(409, 'REGISTRATION_INCOMPLETE', 'The student must resubmit the registration with complete profile and guardian information');
      }

      const conflict = (await client.query(
        `SELECT 1 FROM users WHERE username = $1
         UNION ALL SELECT 1 FROM students WHERE student_number = $1
         UNION ALL SELECT 1 FROM google_identity_links WHERE google_subject = $2 AND revoked_at IS NULL
         UNION ALL SELECT 1 FROM google_department_registrations WHERE google_subject = $2 AND status = 'PENDING'
         LIMIT 1`,
        [registration.student_number, registration.google_subject]
      )).rows[0];
      if (conflict) throw new ApiError(409, 'REGISTRATION_CONFLICT', REVIEW_FAILURE);

      const unusablePassword = randomBytes(32).toString('base64url');
      const passwordHash = await hashPassword(unusablePassword);
      const user = (await client.query(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES ($1, $2, 'STUDENT', TRUE) RETURNING id, username`,
        [registration.student_number, passwordHash]
      )).rows[0];
      const qrCode = randomBytes(32).toString('base64url');
      const student = (await client.query(
        `INSERT INTO students (user_id, student_number, first_name, last_name, email, phone_number, program, section, year_level, qr_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [user.id, registration.student_number, registration.first_name, registration.last_name, registration.google_email,
          registration.phone_number, registration.program, registration.section, registration.year_level, qrCode]
      )).rows[0];
      await client.query(
        `INSERT INTO student_guardians (student_id, guardian_name, relationship, phone_number, is_primary)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [student.id, registration.guardian_name, registration.guardian_relationship, registration.guardian_phone_number]
      );
      const link = (await client.query(
        `INSERT INTO google_identity_links (user_id, google_subject, google_email)
         VALUES ($1, $2, $3) RETURNING id`,
        [user.id, registration.google_subject, registration.google_email]
      )).rows[0];
      const reviewed = (await client.query(
        `UPDATE google_student_registrations
         SET status = 'APPROVED', review_reason = $2, reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [registration.id, normalizedReason, Number(reviewerId)]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description)
         VALUES ($1, 'GOOGLE_REGISTRATION_APPROVED', 'google_student_registrations', $2, $3),
                ($1, 'GOOGLE_LINK', 'google_identity_links', $4, 'Google identity linked after enrollment approval')`,
        [Number(reviewerId), registration.id, `Student registration approved: ${normalizedReason}`, link.id]
      );
      await client.query('COMMIT');
      return publicRegistration(reviewed);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'REGISTRATION_CONFLICT', REVIEW_FAILURE);
      throw error;
    } finally {
      client.release();
    }
  };

  return { list, review };
};

module.exports = { createGoogleRegistrationService, publicRegistration, REVIEW_FAILURE };
