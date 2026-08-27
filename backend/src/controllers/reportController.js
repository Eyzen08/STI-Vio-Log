const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');

// Violation Report
const getViolationReport = async (req, res) => {
  try {
    const { status, student_id, sort_by, from_date, to_date } = req.query;

    let query = `
      SELECT 
        v.id,
        v.student_id,
        s.first_name,
        s.last_name,
        s.student_number,
        vt.violation_name,
        v.incident_date,
        v.status,
        v.required_service_hours,
        v.completed_service_hours,
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
    return res.status(500).json({
      success: false,
      message: 'Failed to generate violation report'
    });
  }
};

// Community Service Report
const getCommunityServiceReport = async (req, res) => {
  try {
    const { status, student_id, sort_by } = req.query;

    let query = `
      SELECT 
        cs.id,
        cs.student_id,
        s.first_name,
        s.last_name,
        s.student_number,
        v.id as violation_id,
        cs.required_hours,
        cs.completed_hours,
        cs.remaining_hours,
        cs.status,
        cs.assigned_at,
        cs.completed_at
      FROM community_service_assignments cs
      JOIN students s ON cs.student_id = s.id
      JOIN violations v ON cs.violation_id = v.id
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
      total_pending_hours: result.rows.reduce((sum, row) => sum + (row.remaining_hours || 0), 0),
      data: result.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
  console.error('DTR report error:', error);
  return res.status(500).json({
    success: false,
    message: 'Failed to generate DTR report',
    error: error.message
  });
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
        s.id,
        s.first_name,
        s.last_name,
        s.student_number,
        s.program,
        s.year_level,
        COUNT(DISTINCT CASE WHEN v.status = 'OPEN' THEN v.id END) as open_violations,
        SUM(CASE WHEN v.status = 'OPEN' THEN v.required_service_hours - COALESCE(v.completed_service_hours, 0) ELSE 0 END) as pending_hours,
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
