const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');

const OFFICER_ROLES = new Set(['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']);
const AVAILABILITY = new Set(['AVAILABLE', 'UNAVAILABLE', 'ABSENT']);
const clean = (value, max = 1000) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max)
  : '';

const dateValue = (value, name, required = false) => {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', `${name} must be a valid date and time`);
  return date.toISOString();
};

const expireTemporaryAssignments = async (client) => {
  const expired = await client.query(
    `UPDATE officer_department_assignments
     SET status='ENDED', ended_at=COALESCE(ended_at,ends_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP
     WHERE assignment_type='TEMPORARY' AND status='ACTIVE'
       AND ends_at IS NOT NULL AND ends_at <= CURRENT_TIMESTAMP
     RETURNING id,department_id,officer_user_id,original_officer_user_id`
  );
  for (const row of expired.rows) {
    await client.query(
      `INSERT INTO audit_logs(user_id,action,table_name,record_id,description)
       VALUES(NULL,'OFFICER_TEMPORARY_EXPIRED','officer_department_assignments',$1,$2)`,
      [row.id, `Temporary responsibility expired; department ${row.department_id} restored to officer ${row.original_officer_user_id}`]
    );
  }
  return expired.rows;
};

const officerSelect = `
  SELECT u.id AS officer_user_id,u.username,u.role,u.is_active,
    COALESCE(sp.first_name,dh.first_name) AS first_name,
    COALESCE(sp.last_name,dh.last_name) AS last_name,
    COALESCE(oa.availability_status,'AVAILABLE') AS availability_status,
    oa.reason AS availability_reason,
    oda.department_id,d.department_name,d.department_code,
    oda.id AS assignment_id,oda.assignment_type,oda.original_officer_user_id,
    COALESCE(original_sp.first_name,original_dh.first_name) AS original_first_name,
    COALESCE(original_sp.last_name,original_dh.last_name) AS original_last_name,
    oda.starts_at,oda.ends_at,oda.reason,oda.status,oda.created_at,oda.updated_at
  FROM officer_department_assignments oda
  JOIN users u ON u.id=oda.officer_user_id
  JOIN departments d ON d.id=oda.department_id
  LEFT JOIN staff_profiles sp ON sp.user_id=u.id
  LEFT JOIN department_heads dh ON dh.user_id=u.id
  LEFT JOIN staff_profiles original_sp ON original_sp.user_id=oda.original_officer_user_id
  LEFT JOIN department_heads original_dh ON original_dh.user_id=oda.original_officer_user_id
  LEFT JOIN officer_availability oa ON oa.officer_user_id=u.id`;

const createOfficerResponsibilityService = ({ pool } = {}) => {
  if (!pool?.connect || !pool?.query) throw new TypeError('Officer responsibility dependencies are required');

  const list = async ({ departmentId, includeHistory = false } = {}) => {
    if (departmentId != null && !isPositiveId(departmentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid department is required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expireTemporaryAssignments(client);
      const params = [];
      let where = includeHistory ? 'WHERE 1=1' : "WHERE oda.status='ACTIVE'";
      if (departmentId) { params.push(Number(departmentId)); where += ` AND oda.department_id=$${params.length}`; }
      const result = await client.query(`${officerSelect} ${where} ORDER BY d.department_name,oda.status,oda.assignment_type,oda.starts_at DESC`, params);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  const available = async ({ departmentId }) => {
    if (!isPositiveId(departmentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid department is required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expireTemporaryAssignments(client);
      const result = await client.query(
        `${officerSelect}
         WHERE oda.department_id=$1 AND oda.status='ACTIVE'
           AND oda.starts_at <= CURRENT_TIMESTAMP
           AND (oda.ends_at IS NULL OR oda.ends_at > CURRENT_TIMESTAMP)
           AND u.is_active=TRUE AND u.role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD')
           AND d.is_active=TRUE AND COALESCE(oa.availability_status,'AVAILABLE')='AVAILABLE'
           AND (oda.assignment_type='TEMPORARY' OR NOT EXISTS (
             SELECT 1 FROM officer_department_assignments transfer
             WHERE transfer.department_id=oda.department_id
               AND transfer.original_officer_user_id=oda.officer_user_id
               AND transfer.assignment_type='TEMPORARY' AND transfer.status='ACTIVE'
               AND transfer.starts_at <= CURRENT_TIMESTAMP
               AND (transfer.ends_at IS NULL OR transfer.ends_at > CURRENT_TIMESTAMP)
           ))
         ORDER BY oda.assignment_type DESC,COALESCE(sp.last_name,dh.last_name),COALESCE(sp.first_name,dh.first_name),u.id`,
        [Number(departmentId)]
      );
      await client.query('COMMIT');
      return result.rows;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  const setAvailability = async ({ actorId, officerId, status, reason }) => {
    const next = String(status || '').toUpperCase();
    const why = clean(reason);
    if (!isPositiveId(actorId) || !isPositiveId(officerId) || !AVAILABILITY.has(next) || (next !== 'AVAILABLE' && !why)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Valid availability, officer, and reason are required');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const officer = (await client.query(
        `SELECT id,role,is_active FROM users WHERE id=$1 AND role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD') FOR UPDATE`,
        [Number(officerId)]
      )).rows[0];
      if (!officer) throw new ApiError(404, 'OFFICER_NOT_FOUND', 'Officer account not found');
      if (!officer.is_active) throw new ApiError(409, 'OFFICER_INACTIVE', 'Inactive officers cannot receive availability changes');
      const assigned = (await client.query(
        `SELECT 1 FROM officer_department_assignments
         WHERE officer_user_id=$1 AND status='ACTIVE'
           AND starts_at<=CURRENT_TIMESTAMP AND (ends_at IS NULL OR ends_at>CURRENT_TIMESTAMP) LIMIT 1`,
        [officer.id]
      )).rows[0];
      if (!assigned) throw new ApiError(409, 'OFFICER_UNASSIGNED', 'Only currently assigned officers have an availability status');
      const row = (await client.query(
        `INSERT INTO officer_availability(officer_user_id,availability_status,reason,updated_by_admin_id)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(officer_user_id) DO UPDATE SET availability_status=EXCLUDED.availability_status,
           reason=EXCLUDED.reason,effective_at=CURRENT_TIMESTAMP,updated_by_admin_id=EXCLUDED.updated_by_admin_id,
           updated_at=CURRENT_TIMESTAMP
         RETURNING *`,
        [officer.id, next, next === 'AVAILABLE' ? null : why, Number(actorId)]
      )).rows[0];
      await client.query(
        `INSERT INTO audit_logs(user_id,action,table_name,record_id,description)
         VALUES($1,'OFFICER_AVAILABILITY_UPDATE','officer_availability',$2,$3)`,
        [Number(actorId), officer.id, `Set officer availability to ${next}${why ? `: ${why}` : ''}`]
      );
      await client.query('COMMIT');
      return row;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  const assignPermanent = async ({ actorId, officerId, departmentId, startsAt, reason }) => {
    const why = clean(reason);
    const start = dateValue(startsAt, 'starts_at') || new Date().toISOString();
    if (![actorId, officerId, departmentId].every(isPositiveId) || !why) throw new ApiError(400, 'VALIDATION_ERROR', 'Officer, department, and reason are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('officer-department:' || $1::text || ':' || $2::text))", [Number(officerId), Number(departmentId)]);
      const officer = (await client.query(`SELECT id,role,is_active FROM users WHERE id=$1 AND role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD') FOR UPDATE`, [Number(officerId)])).rows[0];
      const department = (await client.query('SELECT id,is_active FROM departments WHERE id=$1 FOR UPDATE', [Number(departmentId)])).rows[0];
      if (!officer || !OFFICER_ROLES.has(officer.role)) throw new ApiError(404, 'OFFICER_NOT_FOUND', 'Officer account not found');
      if (!officer.is_active || !department?.is_active) throw new ApiError(409, 'ASSIGNMENT_NOT_ALLOWED', 'Only active officers and departments may be assigned');
      const duplicate = (await client.query(`SELECT id FROM officer_department_assignments WHERE officer_user_id=$1 AND department_id=$2 AND assignment_type='PERMANENT' AND status='ACTIVE'`, [officer.id, department.id])).rows[0];
      if (duplicate) throw new ApiError(409, 'ASSIGNMENT_CONFLICT', 'This officer is already assigned to the department');
      const row = (await client.query(
        `INSERT INTO officer_department_assignments(officer_user_id,department_id,assignment_type,starts_at,reason,status,created_by_admin_id)
         VALUES($1,$2,'PERMANENT',$3,$4,'ACTIVE',$5) RETURNING *`,
        [officer.id, department.id, start, why, Number(actorId)]
      )).rows[0];
      await client.query(`INSERT INTO officer_availability(officer_user_id,availability_status,updated_by_admin_id) VALUES($1,'AVAILABLE',$2) ON CONFLICT(officer_user_id) DO NOTHING`, [officer.id, Number(actorId)]);
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description) VALUES($1,'OFFICER_ASSIGNMENT_CREATE','officer_department_assignments',$2,$3)`, [Number(actorId), row.id, `Assigned officer ${officer.id} to department ${department.id}: ${why}`]);
      await client.query('COMMIT');
      return row;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} if (error.code === '23505') throw new ApiError(409, 'ASSIGNMENT_CONFLICT', 'This officer is already assigned to the department'); throw error; }
    finally { client.release(); }
  };

  const createTemporary = async ({ actorId, originalOfficerId, replacementOfficerId, departmentId, startsAt, endsAt, reason }) => {
    const why = clean(reason);
    const start = dateValue(startsAt, 'starts_at') || new Date().toISOString();
    const end = dateValue(endsAt, 'ends_at');
    if (![actorId, originalOfficerId, replacementOfficerId, departmentId].every(isPositiveId) || Number(originalOfficerId) === Number(replacementOfficerId) || !why || (end && end <= start)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Original officer, replacement officer, department, dates, and reason are required');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('temporary-responsibility:' || $1::text))", [Number(departmentId)]);
      await expireTemporaryAssignments(client);
      const people = await client.query(`SELECT id,role,is_active FROM users WHERE id=ANY($1::bigint[]) AND role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD') FOR UPDATE`, [[Number(originalOfficerId), Number(replacementOfficerId)]]);
      if (people.rows.length !== 2 || people.rows.some((row) => !row.is_active)) throw new ApiError(409, 'ASSIGNMENT_NOT_ALLOWED', 'Both officers must be active and authorized');
      const department = (await client.query('SELECT id,is_active FROM departments WHERE id=$1 FOR UPDATE', [Number(departmentId)])).rows[0];
      if (!department?.is_active) throw new ApiError(409, 'ASSIGNMENT_NOT_ALLOWED', 'The affected department must be active');
      const original = (await client.query(`SELECT 1 FROM officer_department_assignments WHERE officer_user_id=$1 AND department_id=$2 AND assignment_type='PERMANENT' AND status='ACTIVE'`, [Number(originalOfficerId), department.id])).rows[0];
      if (!original) throw new ApiError(409, 'ASSIGNMENT_NOT_ALLOWED', 'The original officer is not assigned to this department');
      const originalAvailability = (await client.query(`SELECT availability_status FROM officer_availability WHERE officer_user_id=$1`, [Number(originalOfficerId)])).rows[0];
      if (!['ABSENT', 'UNAVAILABLE'].includes(originalAvailability?.availability_status)) throw new ApiError(409, 'OFFICER_NOT_ABSENT', 'Mark the original officer absent or unavailable before transferring responsibility');
      const replacementAvailability = (await client.query(`SELECT availability_status FROM officer_availability WHERE officer_user_id=$1`, [Number(replacementOfficerId)])).rows[0];
      if (replacementAvailability && replacementAvailability.availability_status !== 'AVAILABLE') throw new ApiError(409, 'REPLACEMENT_UNAVAILABLE', 'The replacement officer is not available');
      const overlap = (await client.query(
        `SELECT id FROM officer_department_assignments
         WHERE department_id=$1 AND assignment_type='TEMPORARY' AND status='ACTIVE'
           AND (original_officer_user_id=$2 OR officer_user_id=$3)
           AND COALESCE(ends_at,'infinity'::timestamptz) > $4::timestamptz
           AND COALESCE($5::timestamptz,'infinity'::timestamptz) > starts_at LIMIT 1`,
        [department.id, Number(originalOfficerId), Number(replacementOfficerId), start, end]
      )).rows[0];
      if (overlap) throw new ApiError(409, 'ASSIGNMENT_CONFLICT', 'A conflicting temporary responsibility already exists');
      const row = (await client.query(
        `INSERT INTO officer_department_assignments(officer_user_id,department_id,original_officer_user_id,assignment_type,starts_at,ends_at,reason,status,created_by_admin_id)
         VALUES($1,$2,$3,'TEMPORARY',$4,$5,$6,'ACTIVE',$7) RETURNING *`,
        [Number(replacementOfficerId), department.id, Number(originalOfficerId), start, end, why, Number(actorId)]
      )).rows[0];
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description) VALUES($1,'OFFICER_TEMPORARY_ASSIGNMENT','officer_department_assignments',$2,$3)`, [Number(actorId), row.id, `Transferred department ${department.id} responsibility from officer ${originalOfficerId} to ${replacementOfficerId}: ${why}`]);
      await client.query('COMMIT');
      return row;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  const transitionTemporary = async ({ actorId, assignmentId, action, endsAt, reason }) => {
    const operation = String(action || '').toUpperCase();
    const why = clean(reason);
    const nextEnd = operation === 'EXTEND' ? dateValue(endsAt, 'ends_at', true) : null;
    if (!isPositiveId(actorId) || !isPositiveId(assignmentId) || !['EXTEND', 'END', 'CANCEL'].includes(operation) || !why) throw new ApiError(400, 'VALIDATION_ERROR', 'Assignment action and reason are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const assignment = (await client.query(`SELECT * FROM officer_department_assignments WHERE id=$1 AND assignment_type='TEMPORARY' FOR UPDATE`, [Number(assignmentId)])).rows[0];
      if (!assignment) throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'Temporary assignment not found');
      if (assignment.status !== 'ACTIVE') throw new ApiError(409, 'ASSIGNMENT_NOT_ACTIVE', 'Temporary assignment is no longer active');
      if (operation === 'EXTEND' && new Date(nextEnd) <= new Date(assignment.ends_at || assignment.starts_at)) throw new ApiError(400, 'VALIDATION_ERROR', 'The extended end must be later than the current assignment end');
      const nextStatus = operation === 'CANCEL' ? 'CANCELLED' : operation === 'END' ? 'ENDED' : 'ACTIVE';
      const row = (await client.query(
        `UPDATE officer_department_assignments SET ends_at=CASE WHEN $2='EXTEND' THEN $3::timestamptz WHEN $2='END' THEN CURRENT_TIMESTAMP ELSE ends_at END,
          status=$4,ended_by_admin_id=CASE WHEN $2 IN ('END','CANCEL') THEN $5 ELSE ended_by_admin_id END,
          ended_at=CASE WHEN $2 IN ('END','CANCEL') THEN CURRENT_TIMESTAMP ELSE ended_at END,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [assignment.id, operation, nextEnd, nextStatus, Number(actorId)]
      )).rows[0];
      await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description) VALUES($1,$2,'officer_department_assignments',$3,$4)`, [Number(actorId), `OFFICER_TEMPORARY_${operation}`, row.id, `${operation} temporary responsibility: ${why}`]);
      await client.query('COMMIT');
      return row;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };

  return { list, available, setAvailability, assignPermanent, createTemporary, transitionTemporary, expireTemporaryAssignments };
};

module.exports = { createOfficerResponsibilityService, expireTemporaryAssignments, AVAILABILITY, OFFICER_ROLES };
