const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');

const METHODS = new Set(['CALL', 'SMS', 'IN_PERSON', 'OTHER']);
const OUTCOMES = new Set(['REACHED', 'NO_ANSWER', 'LEFT_MESSAGE', 'FOLLOW_UP', 'OTHER']);
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const createParentContactService = ({ pool } = {}) => {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Parent contact service dependencies are required');

  const assertScope = async ({ executor = pool, actor, studentId }) => {
    if (!isPositiveId(studentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid student is required');
    const departmentScoped = actor.role === 'DEPARTMENT_HEAD';
    if (departmentScoped && !isPositiveId(actor.department_id)) throw new ApiError(403, 'PARENT_CONTACT_FORBIDDEN', 'Student contact information is not available');
    const result = await executor.query(
      `SELECT s.id, s.student_number, s.first_name, s.last_name
       FROM students s
       WHERE s.id = $1
         AND ($2::boolean = FALSE OR EXISTS (
           SELECT 1 FROM community_service_assignments a
           JOIN community_service_sessions css ON css.assignment_id = a.id
           WHERE a.student_id = s.id AND css.department_id = $3
         ))`,
      [Number(studentId), departmentScoped, departmentScoped ? Number(actor.department_id) : null]
    );
    if (!result.rows[0]) throw new ApiError(404, 'STUDENT_NOT_VISIBLE', 'Student contact information is not available');
    return result.rows[0];
  };

  const read = async ({ actor, studentId }) => {
    const student = await assertScope({ actor, studentId });
    const guardians = await pool.query(
      `SELECT id, guardian_name, relationship, phone_number, email, is_primary
       FROM student_guardians WHERE student_id = $1
       ORDER BY is_primary DESC, id ASC`, [student.id]
    );
    const history = await pool.query(
      `SELECT pcl.id, pcl.guardian_id, pcl.contact_method, pcl.outcome, pcl.notes,
              pcl.created_at, u.role AS contacted_by_role,
              COALESCE(sp.first_name, dh.first_name, u.username) AS contacted_by_first_name,
              COALESCE(sp.last_name, dh.last_name, '') AS contacted_by_last_name,
              d.department_name
       FROM parent_contact_logs pcl
       JOIN users u ON u.id = pcl.contacted_by_user_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       LEFT JOIN department_heads dh ON dh.user_id = u.id
       LEFT JOIN departments d ON d.id = pcl.department_id
       WHERE pcl.student_id = $1 ORDER BY pcl.created_at DESC, pcl.id DESC
       LIMIT 100`, [student.id]
    );
    return { student: { id: Number(student.id), student_number: student.student_number, first_name: student.first_name, last_name: student.last_name }, guardians: guardians.rows.map((row) => ({ ...row, id: Number(row.id) })), contacts: history.rows.map((row) => ({ ...row, id: Number(row.id), guardian_id: Number(row.guardian_id) })) };
  };

  const record = async ({ actor, studentId, guardianId, method, outcome, notes, ipAddress = null }) => {
    const normalizedMethod = String(method || '').trim().toUpperCase();
    const normalizedOutcome = String(outcome || '').trim().toUpperCase();
    const normalizedNotes = clean(notes);
    if (!isPositiveId(guardianId) || !METHODS.has(normalizedMethod) || !OUTCOMES.has(normalizedOutcome)) throw new ApiError(400, 'VALIDATION_ERROR', 'Guardian, contact method, and outcome are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = await assertScope({ executor: client, actor, studentId });
      const guardian = (await client.query('SELECT id FROM student_guardians WHERE id = $1 AND student_id = $2', [Number(guardianId), student.id])).rows[0];
      if (!guardian) throw new ApiError(404, 'GUARDIAN_NOT_FOUND', 'Guardian contact is not available');
      const log = (await client.query(
        `INSERT INTO parent_contact_logs
          (student_id, guardian_id, contacted_by_user_id, department_id, contact_method, outcome, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, guardian_id, contact_method, outcome, notes, created_at`,
        [student.id, guardian.id, Number(actor.id), actor.role === 'DEPARTMENT_HEAD' ? Number(actor.department_id) : null, normalizedMethod, normalizedOutcome, normalizedNotes || null]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, 'PARENT_CONTACT_RECORDED', 'parent_contact_logs', $2, 'Recorded parent or guardian contact outcome', $3)`,
        [Number(actor.id), log.id, ipAddress]
      );
      await client.query('COMMIT');
      return { ...log, id: Number(log.id), guardian_id: Number(log.guardian_id) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
  };

  return { read, record };
};

module.exports = { createParentContactService, METHODS, OUTCOMES };

