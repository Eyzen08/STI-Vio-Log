const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const ExcelJS = require('exceljs');

const REPORT_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLEARED', 'ADMIN_CLOSED', 'INVALID_CANCELLED']);
const bad = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
const validateId = (value) => { if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1)) bad('student_id must be a positive integer'); };
const validateDate = (name, value) => { if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) bad(`${name} must use YYYY-MM-DD`); };
const fail = (res, error, message) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : message });

const violationQuery = (filters) => {
  const { status, student_id, sort_by, from_date, to_date, search } = filters;
  validateId(student_id); validateDate('from_date', from_date); validateDate('to_date', to_date);
  if (status && !REPORT_STATUSES.has(status)) bad('Unsupported report status');
  if (sort_by && !['date_desc', 'date_asc', 'status'].includes(sort_by)) bad('Unsupported sort_by value');
  if (from_date && to_date && from_date > to_date) bad('from_date cannot be after to_date');
  let query = `SELECT s.first_name,s.last_name,s.student_number,vt.violation_name,v.incident_date,v.status,v.description
    FROM violations v JOIN students s ON v.student_id=s.id JOIN violation_types vt ON v.violation_type_id=vt.id WHERE 1=1`;
  const params = [];
  if (status) { query += ` AND v.status=$${params.length + 1}`; params.push(status); }
  if (student_id) { query += ` AND v.student_id=$${params.length + 1}`; params.push(student_id); }
  if (from_date) { query += ` AND v.incident_date >= $${params.length + 1}`; params.push(from_date); }
  if (to_date) { query += ` AND v.incident_date <= $${params.length + 1}`; params.push(to_date); }
  if (search) {
    const normalizedSearch = String(search).trim();
    if (normalizedSearch.length > 100) bad('search must not exceed 100 characters');
    query += ` AND (s.first_name ILIKE $${params.length + 1} OR s.last_name ILIKE $${params.length + 1} OR s.student_number ILIKE $${params.length + 1} OR vt.violation_name ILIKE $${params.length + 1})`;
    params.push(`%${normalizedSearch}%`);
  }
  query += sort_by === 'date_asc' ? ' ORDER BY v.incident_date ASC' : sort_by === 'status' ? ' ORDER BY v.status,v.incident_date DESC' : ' ORDER BY v.incident_date DESC';
  return { query, params };
};

const csvCell = (value) => {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const manilaDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const violationCsv = (rows) => {
  const headers = ['FIRST NAME', 'LAST NAME', 'STUDENT NUMBER', 'VIOLATION NAME', 'INCIDENT DATE', 'STATUS', 'DESCRIPTION'];
  const body = rows.map((row) => [row.first_name,row.last_name,row.student_number,row.violation_name,manilaDate(row.incident_date),row.status,row.description].map(csvCell).join(','));
  return `\uFEFF${[headers.join(','), ...body].join('\r\n')}\r\n`;
};

const titleCaseStatus = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayManilaDate = (value) => {
  const date = manilaDate(value);
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)));
};
const createViolationWorkbook = (rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Violation Report', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  sheet.columns = [
    { header: 'First Name', key: 'first_name', width: 18 },
    { header: 'Last Name', key: 'last_name', width: 20 },
    { header: 'Student Number', key: 'student_number', width: 18 },
    { header: 'Violation Name', key: 'vi_name', width: 34 },
    { header: 'Incident Date', key: 'incident_date', width: 18 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Description', key: 'description', width: 80 }
  ];
  rows.forEach((row) => sheet.addRow({
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    student_number: row.student_number || '',
    violation_name: row.violation_name || '',
    incident_date: displayManilaDate(row.incident_date),
    status: titleCaseStatus(row.status),
    description: row.description || ''
  }));
  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F96' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.autoFilter = { from: 'A1', to: 'G1' };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.height = 30;
      if (rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FD' } };
    }
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD5E1EE' } } };
    });
  });
  sheet.getColumn('student_number').numFmt = '@';
  return workbook;
};

// Violation Report
const getViolationReport = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['status', 'student_id', 'sort_by', 'from_date', 'to_date', 'search']);
    const { query, params } = violationQuery(req.query);
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

const exportViolationReportCsv = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['status', 'student_id', 'sort_by', 'from_date', 'to_date', 'search']);
    const { query, params } = violationQuery(req.query);
    const result = await pool.query(query, params);
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
    const value = (type) => dateParts.find((item) => item.type === type)?.value || '';
    const stamp = `${value('year')}-${value('month')}-${value('day')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="STI_Vio-Log_Student_Violation_Report_${stamp}.csv"`);
    return res.status(200).send(violationCsv(result.rows));
  } catch (error) {
    console.error('Violation CSV export error:', error);
    return fail(res, error, 'Failed to export violation report');
  }
};

const exportViolationReportXlsx = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['status', 'student_id', 'sort_by', 'from_date', 'to_date', 'search']);
    const { query, params } = violationQuery(req.query);
    const result = await pool.query(query, params);
    const stamp = manilaDate(new Date());
    const workbook = createViolationWorkbook(result.rows);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="STI_Vio-Log_Student_Violation_Report_${stamp}.xlsx"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Violation Excel export error:', error);
    return fail(res, error, 'Failed to export violation report');
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
  exportViolationReportCsv,
  exportViolationReportXlsx,
  getCommunityServiceReport,
  getNonComplianceReport,
  violationCsv,
  violationQuery,
  createViolationWorkbook
};
