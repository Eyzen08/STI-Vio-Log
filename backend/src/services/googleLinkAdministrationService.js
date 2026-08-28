const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');

const RECOVERY_FAILURE = 'Unable to recover this Google link';
const cleanReason = (value) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 1000) : '';

const createGoogleLinkAdministrationService = ({ pool } = {}) => {
  if (!pool?.connect) throw new TypeError('Google link administration dependencies are required');

  const revokeStudentLink = async ({ actorId, studentId, reason }) => {
    const why = cleanReason(reason);
    if (!isPositiveId(actorId) || !isPositiveId(studentId) || !why) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid student and recovery reason are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT gil.id AS link_id, gil.user_id
         FROM students s
         JOIN users u ON u.id = s.user_id AND u.role = 'STUDENT'
         JOIN google_identity_links gil ON gil.user_id = u.id AND gil.revoked_at IS NULL
         WHERE s.id = $1
         FOR UPDATE OF u, gil`,
        [Number(studentId)]
      );
      const link = result.rows[0];
      if (!link) throw new ApiError(409, 'GOOGLE_LINK_RECOVERY_UNAVAILABLE', RECOVERY_FAILURE);
      await client.query(
        `UPDATE google_identity_links
         SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $2, revocation_reason = $3
         WHERE id = $1 AND revoked_at IS NULL`,
        [link.link_id, Number(actorId), why]
      );
      await client.query('UPDATE users SET session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [link.user_id]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description)
         VALUES ($1, 'GOOGLE_LINK_REVOKE', 'google_identity_links', $2, $3)`,
        [Number(actorId), link.link_id, `Revoked student Google link: ${why}`]
      );
      await client.query('COMMIT');
      return { student_id: Number(studentId), revoked: true };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
  };

  return { revokeStudentLink };
};

module.exports = { createGoogleLinkAdministrationService, RECOVERY_FAILURE };
