const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { passwordIsStrong } = require('./passwordPolicy');
const { hashSecret } = require('./otpService');

const STUDENT_NUMBER_PATTERN = /^\d{11}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max)
  : '';
const normalizeName = (value) => clean(value, 250).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const splitName = (fullName) => {
  const parts = clean(fullName, 250).split(' ').filter(Boolean);
  return { firstName: parts.slice(0, -1).join(' ') || parts[0], lastName: parts.length > 1 ? parts.at(-1) : '.' };
};

const createStudentPasswordAuthService = ({ pool, otpService, hashPassword = (value) => bcrypt.hash(value, 12), comparePassword = bcrypt.compare, now = () => new Date(), randomBytes = crypto.randomBytes } = {}) => {
  if (!pool?.connect || !otpService) throw new TypeError('Student authentication dependencies are required');

  const validateRegistration = ({ fullName, studentNumber, email, password, confirmPassword }) => {
    const values = {
      fullName: clean(fullName, 250),
      studentNumber: clean(studentNumber, 50),
      email: clean(email, 255).toLowerCase()
    };
    if (!values.fullName || !values.studentNumber || !values.email || !password || !confirmPassword) throw new ApiError(400, 'VALIDATION_ERROR', 'All registration fields are required');
    if (!STUDENT_NUMBER_PATTERN.test(values.studentNumber)) throw new ApiError(400, 'INVALID_STUDENT_NUMBER', 'Student Number must contain exactly 11 digits');
    if (!EMAIL_PATTERN.test(values.email)) throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid email address');
    if (!passwordIsStrong(password)) throw new ApiError(400, 'WEAK_PASSWORD', 'Password must have at least 8 characters, one uppercase letter, one number, and one symbol');
    if (password !== confirmPassword) throw new ApiError(400, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
    return values;
  };

  const register = async (input) => {
    const values = validateRegistration(input);
    const passwordHash = await hashPassword(input.password);
    const client = await pool.connect();
    let registration;
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration:' || LOWER($1)))", [values.studentNumber]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration-email:' || LOWER($1)))", [values.email]);
      const emailOwner = (await client.query('SELECT 1 FROM students WHERE LOWER(email)=LOWER($1) LIMIT 1', [values.email])).rows[0];
      if (emailOwner) throw new ApiError(409, 'REGISTRATION_CONFLICT', 'Student Number or email is already registered');
      const existing = (await client.query(
        `SELECT s.id,s.user_id,s.first_name,s.middle_name,s.last_name,u.email_verified
         FROM students s JOIN users u ON u.id=s.user_id WHERE s.student_number=$1 FOR UPDATE`,
        [values.studentNumber]
      )).rows[0];
      if (existing?.email_verified) throw new ApiError(409, 'REGISTRATION_CONFLICT', 'Student Number or email is already registered');
      if (existing) {
        const officialName = normalizeName([existing.first_name, existing.middle_name, existing.last_name].filter(Boolean).join(' '));
        if (officialName !== normalizeName(values.fullName)) throw new ApiError(409, 'STUDENT_RECORD_MISMATCH', 'Student details do not match the school record');
      }
      await client.query("UPDATE student_account_registrations SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE (student_number=$1 OR LOWER(email)=LOWER($2)) AND status='PENDING'", [values.studentNumber, values.email]);
      registration = (await client.query(
        `INSERT INTO student_account_registrations(student_number,full_name,email,password_hash)
         VALUES($1,$2,$3,$4) RETURNING id,email`,
        [values.studentNumber, values.fullName, values.email, passwordHash]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs(action,table_name,record_id,description)
         VALUES('STUDENT_REGISTRATION_INITIATED','student_account_registrations',$1,'Student password registration initiated; email verification pending')`,
        [registration.id]
      );
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'REGISTRATION_CONFLICT', 'Student Number or email is already registered');
      throw error;
    } finally { client.release(); }
    await otpService.issue({ purpose: 'STUDENT_EMAIL_VERIFICATION', registrationId: registration.id, email: registration.email });
    return { registration_id: Number(registration.id), email: registration.email };
  };

  const resendRegistrationOtp = async ({ registrationId }) => {
    const result = await pool.query("SELECT id,email FROM student_account_registrations WHERE id=$1 AND status='PENDING'", [Number(registrationId)]);
    const registration = result.rows[0];
    if (!registration) throw new ApiError(400, 'REGISTRATION_UNAVAILABLE', 'Registration is no longer available');
    await otpService.issue({ purpose: 'STUDENT_EMAIL_VERIFICATION', registrationId: registration.id, email: registration.email });
  };

  const verifyRegistration = async ({ registrationId, code, ipAddress = null }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const registration = (await client.query("SELECT * FROM student_account_registrations WHERE id=$1 AND status='PENDING' FOR UPDATE", [Number(registrationId)])).rows[0];
      if (!registration) throw new ApiError(400, 'REGISTRATION_UNAVAILABLE', 'Registration is no longer available');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration:' || LOWER($1)))", [registration.student_number]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration-email:' || LOWER($1)))", [registration.email]);
      await otpService.verify({ purpose: 'STUDENT_EMAIL_VERIFICATION', registrationId: registration.id, code, client });
      const conflict = (await client.query('SELECT 1 FROM users u LEFT JOIN students s ON s.user_id=u.id WHERE u.username=$1 OR LOWER(s.email)=LOWER($2) LIMIT 1', [registration.student_number, registration.email])).rows[0];
      if (conflict) throw new ApiError(409, 'REGISTRATION_CONFLICT', 'Student Number or email is already registered');
      const user = (await client.query(
        `INSERT INTO users(username,password_hash,role,is_active,must_change_password,email_verified)
         VALUES($1,$2,'STUDENT',TRUE,FALSE,TRUE) RETURNING id`,
        [registration.student_number, registration.password_hash]
      )).rows[0];
      const names = splitName(registration.full_name);
      const student = (await client.query(
        `INSERT INTO students(user_id,student_number,first_name,last_name,email,qr_code)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [user.id, registration.student_number, names.firstName, names.lastName, registration.email, `STI-${crypto.randomUUID()}`]
      )).rows[0];
      await client.query("UPDATE student_account_registrations SET status='VERIFIED',verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [registration.id]);
      await client.query(
        `INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
         VALUES($1,'STUDENT_EMAIL_VERIFIED','students',$2,'Student email verified and password account activated',$3)`,
        [user.id, student.id, ipAddress]
      );
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if (error.code === '23505') throw new ApiError(409, 'REGISTRATION_CONFLICT', 'Student Number or email is already registered');
      throw error;
    } finally { client.release(); }
  };

  const requestPasswordReset = async ({ identifier }) => {
    const value = clean(identifier, 255).toLowerCase();
    const account = (await pool.query(
      `SELECT u.id,s.email FROM users u JOIN students s ON s.user_id=u.id
       WHERE u.role='STUDENT' AND u.is_active=TRUE AND u.email_verified=TRUE
       AND (LOWER(u.username)=LOWER($1) OR LOWER(s.email)=LOWER($1)) LIMIT 1`,
      [value]
    )).rows[0];
    if (account?.email) {
      try {
        await otpService.issue({ purpose: 'STUDENT_PASSWORD_RESET', userId: account.id, email: account.email });
      } catch (_) {
        // Password-recovery responses must not reveal account existence,
        // SMTP state, or per-account resend cooldown state.
      }
    }
  };

  const verifyPasswordReset = async ({ identifier, code }) => {
    const value = clean(identifier, 255).toLowerCase();
    const client = await pool.connect();
    let rawToken;
    try {
      await client.query('BEGIN');
      const account = (await client.query(
        `SELECT u.id FROM users u JOIN students s ON s.user_id=u.id
         WHERE u.role='STUDENT' AND u.is_active=TRUE AND u.email_verified=TRUE
         AND (LOWER(u.username)=LOWER($1) OR LOWER(s.email)=LOWER($1)) FOR UPDATE`, [value]
      )).rows[0];
      if (!account) throw new ApiError(400, 'OTP_INVALID_OR_EXPIRED', 'Verification code is invalid or expired');
      await otpService.verify({ purpose: 'STUDENT_PASSWORD_RESET', userId: account.id, code, client });
      await client.query('UPDATE password_reset_authorizations SET used_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND used_at IS NULL', [account.id]);
      rawToken = randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO password_reset_authorizations(user_id,token_hash,expires_at)
         VALUES($1,$2,$3)`,
        [account.id, hashSecret(rawToken), new Date(now().getTime() + 15 * 60 * 1000)]
      );
      await client.query('COMMIT');
      return { reset_token: rawToken };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
  };

  const resetPassword = async ({ resetToken, newPassword, confirmPassword, ipAddress = null }) => {
    if (!passwordIsStrong(newPassword)) throw new ApiError(400, 'WEAK_PASSWORD', 'Password must have at least 8 characters, one uppercase letter, one number, and one symbol');
    if (newPassword !== confirmPassword) throw new ApiError(400, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const authorization = (await client.query(
        `SELECT * FROM password_reset_authorizations
         WHERE token_hash=$1 AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP FOR UPDATE`,
        [hashSecret(resetToken || '')]
      )).rows[0];
      if (!authorization) throw new ApiError(401, 'RESET_AUTHORIZATION_INVALID', 'Password reset authorization is invalid or expired');
      const user = (await client.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [authorization.user_id])).rows[0];
      if (await comparePassword(newPassword, user.password_hash)) throw new ApiError(409, 'PASSWORD_REUSE', 'New password must be different from the current password');
      const passwordHash = await hashPassword(newPassword);
      await client.query('UPDATE users SET password_hash=$2,must_change_password=FALSE,session_version=session_version+1,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [authorization.user_id, passwordHash]);
      await client.query('UPDATE password_reset_authorizations SET used_at=CURRENT_TIMESTAMP WHERE id=$1', [authorization.id]);
      await client.query(
        `INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
         VALUES($1,'STUDENT_PASSWORD_RESET','users',$1,'Student completed verified password reset',$2)`,
        [authorization.user_id, ipAddress]
      );
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
  };

  return { register, resendRegistrationOtp, verifyRegistration, requestPasswordReset, verifyPasswordReset, resetPassword };
};

module.exports = { createStudentPasswordAuthService, STUDENT_NUMBER_PATTERN, EMAIL_PATTERN, normalizeName, splitName };
