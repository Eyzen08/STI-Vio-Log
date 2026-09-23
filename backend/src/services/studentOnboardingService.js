const { ApiError } = require('../utils/api');
const { isValidPhone, normalizePhone } = require('../utils/validators');

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
  return { onboarding_required: step !== 'COMPLETE', onboarding_step: step };
};

const createStudentOnboardingService = ({ pool } = {}) => {
  if (!pool?.connect) throw new TypeError('Student onboarding dependencies are required');

  const completeProfile = async ({ userId, phoneNumber, guardianName, guardianRelationship, guardianPhoneNumber, ipAddress = null }) => {
    const values = {
      phoneNumber: clean(phoneNumber, 30), guardianName: clean(guardianName, 200),
      guardianRelationship: clean(guardianRelationship, 100), guardianPhoneNumber: clean(guardianPhoneNumber, 30)
    };
    if (!Object.values(values).every(Boolean)) throw new ApiError(400, 'VALIDATION_ERROR', 'Complete all student and guardian contact information');
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
      await client.query('UPDATE students SET phone_number=$2,onboarding_required=FALSE,onboarding_completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [student.id,values.phoneNumber]);
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

  return { completeProfile };
};

module.exports = { createStudentOnboardingService, onboardingStep, onboardingState };
