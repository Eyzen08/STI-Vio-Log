const { ApiError } = require('../utils/api');
const {recordSecurityEvent}=require('./securityEventService');
const { isValidEmail } = require('../utils/validators');

const GOOGLE_EMAIL_PURPOSE = 'STUDENT_ONBOARDING_GOOGLE_EMAIL';

const onboardingStep = (row) => {
  if (!row || row.role !== 'STUDENT' || (!row.google_rebind_required && (!row.onboarding_required || row.onboarding_completed_at))) return 'COMPLETE';
  if (row.must_change_password) return 'PASSWORD';
  if (!row.google_linked) return 'GOOGLE';
  return 'PROFILE';
};

const onboardingState = (row) => {
  const step = onboardingStep(row);
  const state = { onboarding_required: step !== 'COMPLETE', onboarding_step: step };
  if (step === 'GOOGLE') {
    state.google_onboarding_stage = row.pending_google_email_verified_at ? 'OAUTH' : row.pending_google_email ? 'OTP' : 'EMAIL';
    state.onboarding_google_email = row.email || row.pending_google_email || null;
  }
  return state;
};

const createStudentOnboardingService = ({ pool, otpService = null } = {}) => {
  if (!pool?.connect) throw new TypeError('Student onboarding dependencies are required');

  const requireGoogleStage = async (client, userId) => {
    const student = (await client.query(
      `SELECT s.id,s.email,s.google_rebind_required,s.pending_google_email,s.pending_google_email_verified_at,s.onboarding_required,s.onboarding_completed_at,
              u.id user_id,u.role,u.must_change_password,
              EXISTS(SELECT 1 FROM google_identity_links gil WHERE gil.user_id=u.id AND gil.revoked_at IS NULL) google_linked
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE u.id=$1 AND u.role='STUDENT' AND u.is_active=TRUE FOR UPDATE OF s,u`, [Number(userId)]
    )).rows[0];
    if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
    if (student.must_change_password) throw new ApiError(409, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing');
    if (!student.google_rebind_required && (!student.onboarding_required || student.onboarding_completed_at)) throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETE', 'Student onboarding is already complete');
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
      if (!normalizedEmail.endsWith('@gmail.com') || normalizedEmail !== String(student.email || '').trim().toLowerCase()) throw new ApiError(409, 'GOOGLE_EMAIL_MISMATCH', 'Use the Gmail recorded by the Discipline Office. Contact the office to correct it');
      await client.query(`UPDATE students SET pending_google_email=$2,pending_google_email_verified_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [student.id,normalizedEmail]);
      await client.query('COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} if(error.code==='GOOGLE_EMAIL_MISMATCH')await recordSecurityEvent({actor:{id:Number(userId),role:'STUDENT'},action:'STUDENT_GOOGLE_LINK_CONFLICT',targetType:'USER_ACCOUNT',targetId:userId,targetLabel:'Student account',details:{conflict_type:'GMAIL'},reason:'Requested Gmail differs from recorded address',result:'DENIED',database:client});throw error; }
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
      if (student.pending_google_email !== String(student.email || '').trim().toLowerCase()) throw new ApiError(409,'GOOGLE_EMAIL_MISMATCH','Request a new code for the Gmail recorded by the Discipline Office');
      await otpService.verify({purpose:GOOGLE_EMAIL_PURPOSE,userId:Number(userId),email:student.pending_google_email,code,client});
      await client.query('UPDATE students SET pending_google_email_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [student.id]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'STUDENT_GOOGLE_EMAIL_VERIFIED','students',$2,'Student verified the pending Google account email during onboarding',$3)`, [Number(userId),student.id,ipAddress]);
      await client.query('COMMIT');
      return {onboarding_required:true,onboarding_step:'GOOGLE',google_onboarding_stage:'OAUTH',onboarding_google_email:student.pending_google_email};
    } catch (error) { try { await client.query(error.commitOtpAttempt ? 'COMMIT' : 'ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  // Official academic, contact, and guardian details are entered by the
  // Discipline Office during account creation. This step only confirms that
  // the student has reviewed the school-managed information and unlocks the
  // portal after password change and Google linking are complete.
  const completeProfile = async ({ userId, ipAddress = null }) => {
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
      if (!student.google_linked) throw new ApiError(409, 'STUDENT_ONBOARDING_REQUIRED', 'Bind a Google account before completing onboarding');
      await client.query('UPDATE students SET onboarding_required=FALSE,onboarding_completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [student.id]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address)
        VALUES($1,'STUDENT_ONBOARDING_COMPLETE','students',$2,'Student reviewed and confirmed school-managed information during mandatory account onboarding',$3)`, [Number(userId),student.id,ipAddress]);
      await client.query('COMMIT');
      return { onboarding_required:false, onboarding_step:'COMPLETE' };
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  return { requestGoogleEmail, verifyGoogleEmail, completeProfile };
};

module.exports = { createStudentOnboardingService, onboardingStep, onboardingState, GOOGLE_EMAIL_PURPOSE };
