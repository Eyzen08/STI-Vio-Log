const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');

const REPORT_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLEARED', 'ADMIN_CLOSED', 'INVALID_CANCELLED']);
const bad = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
const validateId = (value) => { if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1)) bad('student_id must be a positive integer'); };
const validateDate = (name, value) => { if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) bad(`${name} must use YYYY-MM-DD`); };
const fail = (res, error, message) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : message });

// Violation Report
const getViolationReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['status', 'student_id', 'sort_by', 'from_date', 'to_date']);
    const { status, student_id, sort_by, from_date, to_date } = req.query;
    validateId(student_id); validateDate('from_date', from_date); validateDate('to_date', to_date);
    if (status && !REPORT_STATUSES.has(status)) bad('Unsupported report status');
    if (sort_by && !['date_desc', 'date_asc', 'status'].includes(sort_by)) bad('Unsupported sort_by value');
    if (from_date && to_date && from_date > to_date) bad('from_date cannot be after to_date');

    let query = `
      SELECT
        s.first_name,
        s.last_name,
        s.student_number,
        vt.violation_name,
        v.incident_date,
        v.status,
        v.description
      FROM violations v
      JOIN students s ON v.student_id = s.id
      JOIN violation_types vt ON v.violation_type_id = vt.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND v.status = $${params.length + 1}`;
      params.push(status);
    }

    if (student_id) {
      query += ` AND v.student_id = $${params.length + 1}`;
      params.push(student_id);
    }

    if (from_date) {
      query += ` AND v.incident_date >= $${params.length + 1}`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND v.incident_date <= $${params.length + 1}`;
      params.push(to_date);
    }

    if (sort_by === 'date_desc') {
      query += ` ORDER BY v.incident_date DESC`;
    } else if (sort_by === 'date_asc') {
      query += ` ORDER BY v.incident_date ASC`;
    } else if (sort_by === 'status') {
      query += ` ORDER BY v.status, v.incident_date DESC`;
    } else {
      query += ` ORDER BY v.incident_date DESC`;
    }

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      report_type: 'violations',
      total_records: result.rows.length,
      data: result.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Violation report error:', error);
    return fail(res, error, 'Failed to generate violation report');
  }
};

// Community Service Report
const getCommunityServiceReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['status', 'student_id', 'sort_by']);
    const { status, student_id, sort_by } = req.query;
    validateId(student_id);
    if (status && !REPORT_STATUSES.has(status)) bad('Unsupported report status');
    if (sort_by && !['hours_asc', 'hours_desc', 'status'].includes(sort_by)) bad('Unsupported sort_by value');

    let query = `
      SELECT
        s.first_name,
        s.last_name,
        s.student_number,
        vt.violation_name,
        d.department_name,
        cs.required_hours,
        cs.completed_hours,
        cs.remaining_hours,
        cs.status,
        cs.assigned_at,
        cs.completed_at
      FROM community_service_assignments cs
      JOIN students s ON cs.student_id = s.id
      JOIN violations v ON cs.violation_id = v.id
      JOIN violation_types vt ON vt.id = v.violation_type_id
      LEFT JOIN departments d ON d.id = cs.department_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND cs.status = $${params.length + 1}`;
      params.push(status);
    }

    if (student_id) {
      query += ` AND cs.student_id = $${params.length + 1}`;
      params.push(student_id);
    }

    if (sort_by === 'hours_asc') {
      query += ` ORDER BY cs.remaining_hours ASC`;
    } else if (sort_by === 'hours_desc') {
      query += ` ORDER BY cs.remaining_hours DESC`;
    } else if (sort_by === 'status') {
      query += ` ORDER BY cs.status, cs.remaining_hours DESC`;
    } else {
      query += ` ORDER BY cs.assigned_at DESC`;
    }

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      report_type: 'community_service',
      total_records: result.rows.length,
      total_pending_hours: result.rows.reduce((sum, row) => sum + Number(row.remaining_hours || 0), 0),
      data: result.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
  console.error('Community service report error:', error);
  return fail(res, error, 'Failed to generate community service report');
}
};

// Non-Compliance Report
const getNonComplianceReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['sort_by']);
    const { sort_by } = req.query;
    if (sort_by && !['date', 'hours', 'violations'].includes(sort_by)) {
      return res.status(400).json({ success: false, message: 'sort_by must be date, hours, or violations' });
    }
    const departmentScoped = req.user.role === 'DEPARTMENT_HEAD';

    const query = `
      SELECT 
        s.first_name,
        s.last_name,
        s.student_number,
        s.program,
        s.year_level,
        COUNT(DISTINCT CASE WHEN v.status = 'OPEN' THEN v.id END) as open_violations,
        (SELECT COALESCE(SUM(a.remaining_hours), 0)
         FROM community_service_assignments a
         WHERE a.student_id = s.id
           AND a.status IN ('OPEN', 'IN_PROGRESS')) AS pending_hours,
        MAX(v.incident_date) as last_violation_date
      FROM students s
      LEFT JOIN violations v ON s.id = v.student_id
      ${departmentScoped ? `WHERE EXISTS (
        SELECT 1
        FROM community_service_assignments scoped_assignment
        JOIN community_service_sessions scoped_session
          ON scoped_session.assignment_id = scoped_assignment.id
        WHERE scoped_assignment.student_id = s.id
          AND scoped_session.department_id = $1
      )` : ''}
      GROUP BY s.id, s.first_name, s.last_name, s.student_number, s.program, s.year_level
      HAVING COUNT(DISTINCT CASE WHEN v.status = 'OPEN' THEN v.id END) > 0
      ORDER BY ${sort_by === 'hours' ? 'pending_hours DESC' : sort_by === 'violations' ? 'open_violations DESC' : 'last_violation_date DESC'}
    `;

    const result = await pool.query(query, departmentScoped ? [req.user.department_id] : []);

    return res.json({
      success: true,
      report_type: 'non_compliance',
      total_non_compliant_students: result.rows.length,
      data: result.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Non-compliance report error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to generate non-compliance report'
    });
  }
};

module.exports = {
  getViolationReport,
  getCommunityServiceReport,
  getNonComplianceReport
};
