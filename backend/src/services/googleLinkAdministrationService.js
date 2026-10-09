const { ApiError } = require('../utils/api');
const { isPositiveId, isValidEmail } = require('../utils/validators');
const { recordSecurityEvent } = require('./securityEventService');

const RECOVERY_FAILURE = 'Unable to recover this Google link';
const cleanReason = (value) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 1000) : '';

const createGoogleLinkAdministrationService = ({ pool } = {}) => {
  if (!pool?.connect) throw new TypeError('Google link administration dependencies are required');

  const revokeStudentLink = async ({ actorId, studentId, reason, email }) => {
    const why = cleanReason(reason);
    if (!isPositiveId(actorId) || !isPositiveId(studentId) || !why) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid student and recovery reason are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT gil.id AS link_id, gil.user_id, s.email
         FROM students s
         JOIN users u ON u.id = s.user_id AND u.role = 'STUDENT'
         JOIN google_identity_links gil ON gil.user_id = u.id AND gil.revoked_at IS NULL
         WHERE s.id = $1
         FOR UPDATE OF u, gil, s`,
        [Number(studentId)]
      );
      const link = result.rows[0];
      if (!link) throw new ApiError(409, 'GOOGLE_LINK_RECOVERY_UNAVAILABLE', RECOVERY_FAILURE);
      const replacementEmail = typeof (email ?? link.email) === 'string' ? (email ?? link.email).trim().toLowerCase() : '';
      if (!isValidEmail(replacementEmail) || replacementEmail.length>255 || !replacementEmail.endsWith('@gmail.com')) throw new ApiError(400,'INVALID_EMAIL','Enter the student’s personal Gmail address for verified recovery');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration-email:' || LOWER($1)))",[replacementEmail]);
      if ((await client.query('SELECT 1 FROM students WHERE LOWER(email)=LOWER($1) AND id<>$2 LIMIT 1',[replacementEmail,Number(studentId)])).rows.length) throw new ApiError(409,'STUDENT_EMAIL_CONFLICT','That Gmail address is already assigned to another student');
      await client.query(
        `UPDATE google_identity_links
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $2, revocation_reason = $3
         WHERE id = $1 AND revoked_at IS NULL`,
        [link.link_id, Number(actorId), why]
      );
      await client.query('UPDATE users SET session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [link.user_id]);
      await client.query('UPDATE students SET email=$2,google_rebind_required=TRUE,pending_google_email=NULL,pending_google_email_verified_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[Number(studentId),replacementEmail]);
      await client.query('UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND revoked_at IS NULL',[link.user_id]);
      await client.query('UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND used_at IS NULL',[link.user_id]);
      await client.query('UPDATE password_reset_authorizations SET used_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND used_at IS NULL',[link.user_id]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description)
         VALUES ($1, 'GOOGLE_LINK_REVOKE', 'google_identity_links', $2, $3)`,
        [Number(actorId), link.link_id, `Revoked student Google link: ${why}`]
      );
      await client.query('COMMIT');
      return { student_id: Number(studentId), revoked: true };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      if(error.code==='STUDENT_EMAIL_CONFLICT') await recordSecurityEvent({actor:{id:Number(actorId)},action:'STUDENT_ACCOUNT_CONFLICT',targetType:'STUDENT_RECORD',targetId:studentId,targetLabel:email,details:{conflict_type:'GMAIL'},reason:'Recovery Gmail already assigned',result:'DENIED',database:client});
      throw error;
    } finally { client.release(); }
  };

  return { revokeStudentLink };
};

module.exports = { createGoogleLinkAdministrationService, RECOVERY_FAILURE };
