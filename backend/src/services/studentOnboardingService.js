const { ApiError } = require('../utils/api');
const { isValidEmail, isValidPhone, normalizePhone, isValidProgram } = require('../utils/validators');

const GOOGLE_EMAIL_PURPOSE = 'STUDENT_ONBOARDING_GOOGLE_EMAIL';

const clean = (value, max) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max)
  : '';

const onboardingStep = (row) => {
  if (!row || row.role !== 'STUDENT' || !row.onboarding_required || row.onboarding_completed_at) return 'COMPLETE';
  if (row.must_change_password) return 'PASSWORD';
  if (!row.google_linked) return 'GOOGLE';
  return 'PROFILE';
};

const onboardingState = (row) => {
  const step = onboardingStep(row);
  const state = { onboarding_required: step !== 'COMPLETE', onboarding_step: step };
  if (step === 'GOOGLE') {
    state.google_onboarding_stage = row.pending_google_email_verified_at ? 'OAUTH' : row.pending_google_email ? 'OTP' : 'EMAIL';
    state.onboarding_google_email = row.pending_google_email || null;
  }
  return state;
};

const createStudentOnboardingService = ({ pool, otpService = null } = {}) => {
  if (!pool?.connect) throw new TypeError('Student onboarding dependencies are required');

  const requireGoogleStage = async (client, userId) => {
    const student = (await client.query(
      `SELECT s.id,s.pending_google_email,s.pending_google_email_verified_at,s.onboarding_required,s.onboarding_completed_at,
              u.id user_id,u.role,u.must_change_password,
              EXISTS(SELECT 1 FROM google_identity_links gil WHERE gil.user_id=u.id AND gil.revoked_at IS NULL) google_linked
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE u.id=$1 AND u.role='STUDENT' AND u.is_active=TRUE FOR UPDATE OF s,u`, [Number(userId)]
    )).rows[0];
    if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
    if (student.must_change_password) throw new ApiError(409, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing');
    if (!student.onboarding_required || student.onboarding_completed_at) throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETE', 'Student onboarding is already complete');
    if (student.google_linked) throw new ApiError(409, 'GOOGLE_ALREADY_LINKED', 'Google account is already linked');
    return student;
  };

  const requestGoogleEmail = async ({ userId, email }) => {
    if (!otpService?.issue) throw new TypeError('Student onboarding OTP service is required');
    const normalizedEmail = typeof email === 'string' ? email.normalize('NFKC').trim().toLowerCase() : '';
    if (!isValidEmail(normalizedEmail)) throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid Google account email address');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = await requireGoogleStage(client,userId);
      await client.query(`UPDATE students SET pending_google_email=$2,pending_google_email_verified_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [student.id,normalizedEmail]);
      await client.query('COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
    await otpService.issue({purpose:GOOGLE_EMAIL_PURPOSE,userId:Number(userId),email:normalizedEmail});
    return {onboarding_required:true,onboarding_step:'GOOGLE',google_onboarding_stage:'OTP',onboarding_google_email:normalizedEmail};
  };

  const verifyGoogleEmail = async ({ userId, code, ipAddress = null }) => {
    if (!otpService?.verify) throw new TypeError('Student onboarding OTP service is required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = await requireGoogleStage(client,userId);
      if (!student.pending_google_email) throw new ApiError(409,'GOOGLE_EMAIL_REQUIRED','Enter a Google account email before verifying a code');
      await otpService.verify({purpose:GOOGLE_EMAIL_PURPOSE,userId:Number(userId),email:student.pending_google_email,code,client});
      await client.query('UPDATE students SET pending_google_email_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [student.id]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'STUDENT_GOOGLE_EMAIL_VERIFIED','students',$2,'Student verified the pending Google account email during onboarding',$3)`, [Number(userId),student.id,ipAddress]);
      await client.query('COMMIT');
      return {onboarding_required:true,onboarding_step:'GOOGLE',google_onboarding_stage:'OAUTH',onboarding_google_email:student.pending_google_email};
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  const completeProfile = async ({ userId, program, section, yearLevel, phoneNumber, guardianName, guardianRelationship, guardianPhoneNumber, ipAddress = null }) => {
    const values = {
      program: clean(program, 150).toUpperCase(), section: clean(section, 100), yearLevel: Number(yearLevel),
      phoneNumber: clean(phoneNumber, 30), guardianName: clean(guardianName, 200),
      guardianRelationship: clean(guardianRelationship, 100), guardianPhoneNumber: clean(guardianPhoneNumber, 30)
    };
    if (![values.program,values.section,values.phoneNumber,values.guardianName,values.guardianRelationship,values.guardianPhoneNumber].every(Boolean)) throw new ApiError(400, 'VALIDATION_ERROR', 'Complete all academic, student, and guardian information');
    if (!isValidProgram(values.program)) throw new ApiError(400, 'INVALID_PROGRAM', 'Select a valid program');
    if (!Number.isInteger(values.yearLevel) || values.yearLevel < 1 || values.yearLevel > 8) throw new ApiError(400, 'INVALID_YEAR_LEVEL', 'Year level must be between 1 and 8');
    if (!isValidPhone(values.phoneNumber) || !isValidPhone(values.guardianPhoneNumber)) throw new ApiError(400, 'INVALID_PHONE', 'Enter valid Philippine phone numbers');
    values.phoneNumber = normalizePhone(values.phoneNumber);
    values.guardianPhoneNumber = normalizePhone(values.guardianPhoneNumber);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = (await client.query(
        `SELECT s.id,s.onboarding_required,s.onboarding_completed_at,u.must_change_password,
                EXISTS(SELECT 1 FROM google_identity_links gil WHERE gil.user_id=u.id AND gil.revoked_at IS NULL) google_linked
         FROM students s JOIN users u ON u.id=s.user_id
         WHERE u.id=$1 AND u.role='STUDENT' AND u.is_active=TRUE FOR UPDATE OF s,u`, [Number(userId)]
      )).rows[0];
      if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
      if (!student.onboarding_required || student.onboarding_completed_at) {
        await client.query('COMMIT');
        return { onboarding_required:false, onboarding_step:'COMPLETE' };
      }
      if (student.must_change_password) throw new ApiError(409, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing');
      if (!student.google_linked) throw new ApiError(409, 'STUDENT_ONBOARDING_REQUIRED', 'Bind a Google account before completing contact information');
      await client.query('UPDATE students SET program=$2,section=$3,year_level=$4,phone_number=$5,onboarding_required=FALSE,onboarding_completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [student.id,values.program,values.section,values.yearLevel,values.phoneNumber]);
      const guardian = (await client.query('SELECT id FROM student_guardians WHERE student_id=$1 ORDER BY is_primary DESC,id ASC LIMIT 1 FOR UPDATE', [student.id])).rows[0];
      await client.query('UPDATE student_guardians SET is_primary=FALSE WHERE student_id=$1 AND ($2::bigint IS NULL OR id<>$2)', [student.id,guardian?.id||null]);
      if (guardian) await client.query('UPDATE student_guardians SET guardian_name=$2,relationship=$3,phone_number=$4,is_primary=TRUE WHERE id=$1', [guardian.id,values.guardianName,values.guardianRelationship,values.guardianPhoneNumber]);
      else await client.query('INSERT INTO student_guardians(student_id,guardian_name,relationship,phone_number,is_primary) VALUES($1,$2,$3,$4,TRUE)', [student.id,values.guardianName,values.guardianRelationship,values.guardianPhoneNumber]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'STUDENT_ONBOARDING_COMPLETE','students',$2,'Student completed mandatory account onboarding',$3)`, [Number(userId),student.id,ipAddress]);
      await client.query('COMMIT');
      return { onboarding_required:false, onboarding_step:'COMPLETE' };
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  return { requestGoogleEmail, verifyGoogleEmail, completeProfile };
};

module.exports = { createStudentOnboardingService, onboardingStep, onboardingState, GOOGLE_EMAIL_PURPOSE };
