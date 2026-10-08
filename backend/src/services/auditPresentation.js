const { sanitizeDetails, SECRET_KEY } = require('./securityEventService');

const SECRET_PATTERN = /(bearer\s+[a-z0-9._~+\/-]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|(?:password(?:_hash)?|temporary_password|otp|token|credential|secret|google_(?:sub|subject|email)|authorization|cookie)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+))/gi;
const redactText = (value) => String(value).replace(SECRET_PATTERN, '[REDACTED]').slice(0, 1000);
const parseDescription = (value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } };
const redactNested = (value) => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactNested);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) || /google_email/i.test(key) ? '[REDACTED]' : redactNested(item)]));
  return value;
};
const safeValue = (value) => redactNested(sanitizeDetails(value));
const sanitizeAuditDescription = (value) => {
  if (!value) return null;
  const parsed = parseDescription(value);
  return parsed ? JSON.stringify(auditDetails({ description: value })) : redactText(value);
};

const EVENT_FIELDS = ['assignment_id', 'department_id', 'supervising_officer_user_id', 'actual_elapsed_minutes', 'timer_limit_minutes', 'worked_minutes', 'credited_minutes', 'completion_reason', 'attendance_outcome', 'supervisor_changed', 'limit_reached', 'actor_role', 'from_status', 'to_status', 'from', 'to', 'policy_scope', 'minor_count', 'major_count', 'grave_count', 'major_level_review_required', 'reason', 'result'];
const CHANGE_FIELDS = new Set(['violation_type_id', 'incident_date', 'incident_time', 'description', 'required_service_hours', 'completed_service_hours', 'status', 'department_id', 'department_head_id']);
const auditDetails = (row) => {
  const parsed = parseDescription(row.description) || {};
  const details = Object.fromEntries(EVENT_FIELDS.filter((key) => parsed[key] !== null && parsed[key] !== undefined).map((key) => [key, safeValue(parsed[key])]));
  for (const key of ['reason', 'result']) if (row[key] != null) details[key] = safeValue(row[key]);
  const changes = {};
  const before = row.previous_values || {}, after = row.new_values || {};
  for (const key of CHANGE_FIELDS) {
    if (parsed.changes?.[key] && typeof parsed.changes[key] === 'object') changes[key] = { before: safeValue(parsed.changes[key].before), after: safeValue(parsed.changes[key].after) };
    if (Object.hasOwn(before, key) || Object.hasOwn(after, key)) changes[key] = { before: safeValue(before[key]), after: safeValue(after[key]) };
  }
  if (Object.keys(changes).length) details.changes = changes;
  return details;
};

const studentColumns = "concat_ws(' ', s.first_name, s.last_name) AS subject_name, s.student_number AS subject_identifier";
const accountColumns = "COALESCE(NULLIF(concat_ws(' ', sp.first_name, sp.last_name), ''), NULLIF(concat_ws(' ', dh.first_name, dh.last_name), ''), NULLIF(concat_ws(' ', ap.first_name, ap.last_name), ''), NULLIF(concat_ws(' ', s.first_name, s.last_name), ''), u.username) AS subject_name, u.username AS subject_identifier";
const accountJoins = 'LEFT JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN department_heads dh ON dh.user_id=u.id LEFT JOIN admin_profiles ap ON ap.user_id=u.id LEFT JOIN students s ON s.user_id=u.id';
// Fixed queries only: audit table names are data, never SQL identifiers.
const CONTEXT_QUERIES = {
  users: `SELECT u.id AS record_id, ${accountColumns} FROM users u ${accountJoins} WHERE u.id=ANY($1::bigint[])`,
  students: `SELECT s.id AS record_id, ${studentColumns} FROM students s WHERE s.id=ANY($1::bigint[])`,
  violations: `SELECT v.id AS record_id, ${studentColumns}, vt.violation_name AS violation_label FROM violations v JOIN students s ON s.id=v.student_id JOIN violation_types vt ON vt.id=v.violation_type_id WHERE v.id=ANY($1::bigint[])`,
  community_service_assignments: `SELECT a.id AS record_id, ${studentColumns}, vt.violation_name AS violation_label, d.department_name FROM community_service_assignments a JOIN students s ON s.id=a.student_id JOIN violations v ON v.id=a.violation_id JOIN violation_types vt ON vt.id=v.violation_type_id LEFT JOIN departments d ON d.id=a.department_id WHERE a.id=ANY($1::bigint[])`,
  community_service_sessions: `SELECT css.id AS record_id, ${studentColumns}, d.department_name, vt.violation_name AS violation_label FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN students s ON s.id=a.student_id JOIN violations v ON v.id=a.violation_id JOIN violation_types vt ON vt.id=v.violation_type_id LEFT JOIN departments d ON d.id=css.department_id WHERE css.id=ANY($1::bigint[])`,
  student_offense_escalations: `SELECT s.id AS record_id, ${studentColumns} FROM students s WHERE s.id=ANY($1::bigint[])`,
  student_clearance: `SELECT c.id AS record_id, ${studentColumns} FROM student_clearance c JOIN students s ON s.id=c.student_id WHERE c.id=ANY($1::bigint[])`,
  clearance_certificates: 'SELECT id AS record_id, student_name AS subject_name, student_number AS subject_identifier, certificate_number FROM clearance_certificates WHERE id=ANY($1::bigint[])',
  departments: 'SELECT id AS record_id, department_name FROM departments WHERE id=ANY($1::bigint[])',
  parent_contact_logs: `SELECT c.id AS record_id, ${studentColumns}, d.department_name FROM parent_contact_logs c JOIN students s ON s.id=c.student_id LEFT JOIN departments d ON d.id=c.department_id WHERE c.id=ANY($1::bigint[])`,
  officer_department_assignments: `SELECT a.id AS record_id, ${accountColumns}, d.department_name FROM officer_department_assignments a JOIN users u ON u.id=a.officer_user_id ${accountJoins} JOIN departments d ON d.id=a.department_id WHERE a.id=ANY($1::bigint[])`,
  officer_availability: `SELECT u.id AS record_id, ${accountColumns} FROM officer_availability a JOIN users u ON u.id=a.officer_user_id ${accountJoins} WHERE u.id=ANY($1::bigint[])`,
  google_identity_links: `SELECT g.id AS record_id, ${accountColumns} FROM google_identity_links g JOIN users u ON u.id=g.user_id ${accountJoins} WHERE g.id=ANY($1::bigint[])`,
  google_student_registrations: "SELECT id AS record_id, concat_ws(' ', first_name,last_name) AS subject_name, student_number AS subject_identifier FROM google_student_registrations WHERE id=ANY($1::bigint[])",
  discipline_officer_signatures: 'SELECT id AS record_id, full_name AS subject_name FROM discipline_officer_signatures WHERE id=ANY($1::bigint[])'
};

const enrichAuditRecords = async (database, rows) => {
  const contexts = new Map();
  const groups = new Map();
  for (const row of rows) {
    if (!Object.hasOwn(CONTEXT_QUERIES, row.table_name) || !row.record_id) continue;
    if (!groups.has(row.table_name)) groups.set(row.table_name, new Set());
    groups.get(row.table_name).add(String(row.record_id));
  }
  await Promise.all([...groups].map(async ([table, ids]) => {
    const result = await database.query(CONTEXT_QUERIES[table], [[...ids]]);
    for (const context of result.rows) {
      const { record_id, ...fields } = context;
      contexts.set(`${table}:${record_id}`, Object.fromEntries(Object.entries(fields).filter(([, value]) => value != null && value !== '').map(([key, value]) => [key, redactText(value)])));
    }
  }));
  const supervisorIds = [...new Set(rows.map((row) => auditDetails(row).supervising_officer_user_id).filter((id) => /^\d+$/.test(String(id))))];
  const supervisors = new Map();
  if (supervisorIds.length) {
    const result = await database.query(CONTEXT_QUERIES.users, [supervisorIds]);
    for (const person of result.rows) supervisors.set(String(person.record_id), redactText(person.subject_name));
  }
  return rows.map((row) => {
    const context = { ...contexts.get(`${row.table_name}:${row.record_id}`) };
    if (row.target_label) context.label = redactText(row.target_label);
    const supervisor = supervisors.get(String(auditDetails(row).supervising_officer_user_id));
    if (supervisor) context.supervisor_name = supervisor;
    return context;
  });
};

module.exports = { sanitizeAuditDescription, auditDetails, enrichAuditRecords };
