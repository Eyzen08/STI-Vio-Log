const pool = require('../config/database');
const { assertAllowedFields, isPositiveId } = require('../utils/validators');

const bad = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
const validateId = (value) => { if (value !== undefined && !isPositiveId(value)) bad('student_id must be a positive integer'); };
const validateDate = (name, value) => { if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) bad(`${name} must use YYYY-MM-DD`); };
const send = (res, type, rows) => res.json({ success: true, report_type: type, total_records: rows.length, data: rows, generated_at: new Date().toISOString() });
const fail = (res, error, message) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : message });
const addFilter = (state, value, expression) => { state.params.push(value); state.sql += ` AND ${expression.replace('?', `$${state.params.length}`)}`; };

const getParentContactReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['student_id', 'contact_method', 'outcome', 'from_date', 'to_date', 'sort_by']);
    const { student_id, contact_method, outcome, from_date, to_date, sort_by = 'date_desc' } = req.query;
    validateId(student_id); validateDate('from_date', from_date); validateDate('to_date', to_date);
    if (from_date && to_date && from_date > to_date) bad('from_date cannot be after to_date');
    if (contact_method && !['CALL', 'SMS', 'IN_PERSON', 'OTHER'].includes(contact_method)) bad('Unsupported contact method');
    if (outcome && !['REACHED', 'NO_ANSWER', 'LEFT_MESSAGE', 'FOLLOW_UP', 'OTHER'].includes(outcome)) bad('Unsupported contact outcome');
    if (!['date_desc', 'date_asc'].includes(sort_by)) bad('Unsupported sort_by value');
    const state = { params: [], sql: '' };
    if (student_id) addFilter(state, student_id, 'pcl.student_id = ?');
    if (contact_method) addFilter(state, contact_method, 'pcl.contact_method = ?');
    if (outcome) addFilter(state, outcome, 'pcl.outcome = ?');
    if (from_date) addFilter(state, from_date, 'pcl.created_at >= ?::date');
    if (to_date) addFilter(state, to_date, "pcl.created_at < (?::date + INTERVAL '1 day')");
    const rows = (await pool.query(`SELECT pcl.id, s.student_number, s.first_name, s.last_name,
      sg.guardian_name, sg.relationship AS guardian_relationship, pcl.contact_method, pcl.outcome,
      pcl.notes, u.username AS contacted_by, d.department_name, pcl.created_at
      FROM parent_contact_logs pcl JOIN students s ON s.id = pcl.student_id
      JOIN student_guardians sg ON sg.id = pcl.guardian_id JOIN users u ON u.id = pcl.contacted_by_user_id
      LEFT JOIN departments d ON d.id = pcl.department_id WHERE 1=1${state.sql}
      ORDER BY pcl.created_at ${sort_by === 'date_asc' ? 'ASC' : 'DESC'}, pcl.id DESC`, state.params)).rows;
    return send(res, 'parent_contacts', rows);
  } catch (error) { return fail(res, error, 'Failed to generate parent-contact report'); }
};

const getClearanceReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['student_id', 'status', 'academic_year', 'semester', 'sort_by']);
    const { student_id, status, academic_year, semester, sort_by = 'date_desc' } = req.query; validateId(student_id);
    if (status && !['NOT_ELIGIBLE', 'PENDING', 'CLEARED'].includes(status)) bad('Unsupported clearance status');
    if (!['date_desc', 'date_asc', 'status'].includes(sort_by)) bad('Unsupported sort_by value');
    const state = { params: [], sql: '' };
    if (student_id) addFilter(state, student_id, 'sc.student_id = ?'); if (status) addFilter(state, status, 'sc.status = ?');
    if (academic_year) addFilter(state, academic_year, 'sc.academic_year = ?'); if (semester) addFilter(state, semester, 'sc.semester = ?');
    const order = sort_by === 'date_asc' ? 'sc.updated_at ASC' : sort_by === 'status' ? 'sc.status, sc.updated_at DESC' : 'sc.updated_at DESC';
    const rows = (await pool.query(`SELECT sc.id, s.student_number, s.first_name, s.last_name, sc.academic_year,
      sc.semester, sc.status, sc.has_active_violation, sc.has_pending_service, sc.cleared_at, sc.remarks, sc.updated_at
      FROM student_clearance sc JOIN students s ON s.id = sc.student_id WHERE 1=1${state.sql}
      ORDER BY ${order}, sc.id DESC`, state.params)).rows;
    return send(res, 'clearance', rows);
  } catch (error) { return fail(res, error, 'Failed to generate clearance report'); }
};

const getGoodStandingReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['student_id', 'sort_by']);
    const { student_id, sort_by = 'student_number' } = req.query; validateId(student_id);
    if (!['student_number', 'name'].includes(sort_by)) bad('Unsupported sort_by value');
    const params = student_id ? [student_id] : []; const filter = student_id ? ' AND s.id = $1' : '';
    const rows = (await pool.query(`SELECT s.student_number, s.first_name, s.last_name, s.program, s.year_level, s.section,
      CASE WHEN COUNT(v.id) = 0 THEN 'GOOD_STANDING' ELSE 'CLEARED' END AS standing, COUNT(v.id)::int AS historical_violations
      FROM students s LEFT JOIN violations v ON v.student_id = s.id
      WHERE NOT EXISTS (SELECT 1 FROM violations ov WHERE ov.student_id = s.id AND ov.status = 'OPEN')
      AND NOT EXISTS (SELECT 1 FROM community_service_assignments ca WHERE ca.student_id = s.id
        AND ca.status IN ('OPEN', 'IN_PROGRESS') AND ca.remaining_hours > 0)${filter}
      GROUP BY s.id ORDER BY ${sort_by === 'name' ? 's.last_name, s.first_name' : 's.student_number'}`, params)).rows;
    return send(res, 'good_standing', rows);
  } catch (error) { return fail(res, error, 'Failed to generate good-standing report'); }
};

module.exports = { getParentContactReport, getClearanceReport, getGoodStandingReport };
