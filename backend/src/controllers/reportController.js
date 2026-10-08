const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const ExcelJS = require('exceljs');
const { createReportWorkbook, reportFilename } = require('../services/reportExport');
const { validReportDate, reportStatusOptions } = require('../../../shared/adminReports.mjs');
const bad = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
const validateId = (value) => { if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1)) bad('student_id must be a positive integer'); };
const validateDate = (name, value) => { if (value !== undefined && !validReportDate(String(value))) bad(`${name} must use a valid YYYY-MM-DD calendar date`); };
const fail = (res, error, message) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : message });

const violationQuery = (filters) => {
  const { status, student_id, sort_by, from_date, to_date, search } = filters;
  validateId(student_id); validateDate('from_date', from_date); validateDate('to_date', to_date);
  if (status && !reportStatusOptions('violations').includes(status)) bad('Unsupported report status');
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

const createViolationWorkbook = rows => createReportWorkbook('violations', { data: rows });

const ANALYTICS_HEADERS = ['Section', 'Metric', 'From', 'To', 'Value', 'Unit'];
const ANALYTICS_SECTIONS = ['Filters', 'Violations Over Time', 'Classification', 'Community Service', 'Department', 'Key Insights'];
const validateAnalyticsSnapshot = (body) => {
  const object = (value, fields) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) bad('Expected an analytics object');
    assertAllowedFields(value, fields);
    if (fields.some(field => value[field] === undefined)) bad('Missing analytics fields');
  };
  const text = (value) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) bad('Invalid analytics text');
  };
  const count = (value) => { if (!Number.isSafeInteger(value) || value < 0) bad('Analytics counts must be nonnegative integers'); };
  const date = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad('Analytics dates must use YYYY-MM-DD');
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) bad('Invalid analytics date');
  };
  object(body, ['range', 'program', 'analytics', 'insights']);
  const { range, analytics, insights } = body;
  object(range, ['from', 'to', 'previousFrom', 'previousTo']);
  Object.values(range).forEach(date);
  if (range.from > range.to || range.previousFrom > range.previousTo || range.previousTo >= range.from) bad('Invalid analytics date range');
  text(body.program);
  object(analytics, ['violationCount', 'previousViolationCount', 'trend', 'classifications', 'programs', 'service']);
  count(analytics.violationCount); count(analytics.previousViolationCount);
  if (!Array.isArray(analytics.trend) || !analytics.trend.length || analytics.trend.length > 6) bad('Invalid analytics trend');
  for (const bucket of analytics.trend) {
    object(bucket, ['from', 'to', 'count']); date(bucket.from); date(bucket.to); count(bucket.count);
    if (bucket.from > bucket.to || bucket.from < range.from || bucket.to > range.to) bad('Invalid trend date range');
  }
  if (!Array.isArray(analytics.classifications) || analytics.classifications.length !== 4 || !Array.isArray(analytics.programs)) bad('Invalid analytics groups');
  const levels = ['MINOR_1', 'MINOR_2', 'MAJOR_LEVEL', 'GRAVE'];
  analytics.classifications.forEach((item, index) => {
    object(item, ['level', 'label', 'count']); text(item.label); count(item.count);
    if (item.level !== levels[index]) bad('Invalid analytics classification');
  });
  for (const item of analytics.programs) { object(item, ['label', 'count']); text(item.label); count(item.count); }
  const total = (rows) => rows.reduce((sum, row) => sum + row.count, 0);
  if (total(analytics.trend) !== analytics.violationCount || total(analytics.programs) !== analytics.violationCount || total(analytics.classifications) > analytics.violationCount) bad('Analytics counts do not match');
  object(analytics.service, ['completed', 'active', 'total', 'completionPercent']);
  const service = analytics.service;
  Object.values(service).forEach(count);
  if (service.completed + service.active !== service.total || service.completionPercent !== (service.total ? Math.round(service.completed / service.total * 100) : 0)) bad('Invalid community service totals');
  const labels = ['Violation change', 'Active service', 'Service completion', 'Overdue assignments'];
  if (!Array.isArray(insights) || insights.length !== labels.length) bad('Invalid analytics insights');
  insights.forEach((item, index) => {
    object(item, ['label', 'value']); text(item.value);
    if (item.label !== labels[index]) bad('Invalid analytics insight');
  });
  return body;
};

const analyticsRows = (snapshot, generatedAt = new Date()) => {
  const { range, program, analytics, insights } = validateAnalyticsSnapshot(snapshot);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(generatedAt);
  const part = type => parts.find(item => item.type === type).value;
  const stamp = `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')} (Asia/Manila)`;
  const row = (section, metric, value, unit = '', from = range.from, to = range.to) => [section, metric, from, to, value, unit];
  const { service } = analytics;
  return [
    row('Filters', 'Department / Program', program === 'ALL' ? 'All Departments / Programs' : program, '', '', ''),
    row('Filters', 'Date range', '', '', range.from, range.to),
    row('Filters', 'Comparison dates', '', '', range.previousFrom, range.previousTo),
    row('Filters', 'Generated at', stamp, '', '', ''),
    row('Filters', 'Current violations', analytics.violationCount, 'violations'),
    row('Filters', 'Previous violations', analytics.previousViolationCount, 'violations', range.previousFrom, range.previousTo),
    row('Filters', 'Classification basis', 'Current student classification across selected records'),
    row('Filters', 'Service basis', 'Current status of assignments created in the selected range'),
    ...analytics.trend.map(bucket => row('Violations Over Time', 'Recorded violations', bucket.count, 'violations', bucket.from, bucket.to)),
    ...analytics.classifications.map(item => row('Classification', item.label, item.count, 'violations')),
    row('Community Service', 'Total assignments', service.total, 'assignments'),
    row('Community Service', 'Completed', service.completed, 'assignments'),
    row('Community Service', 'In Progress', service.active, 'assignments'),
    row('Community Service', 'Completion', service.completionPercent, 'percent'),
    row('Community Service', 'In Progress share', service.total ? 100 - service.completionPercent : 0, 'percent'),
    row('Community Service', 'Overdue assignments', 'Overdue data unavailable'),
    ...analytics.programs.map(item => row('Department', item.label, item.count, 'violations')),
    ...(!analytics.programs.length ? [row('Department', 'No records for this selection.', 0, 'violations')] : []),
    ...(!service.total ? [row('Community Service', 'Status', 'No assignments')] : []),
    ...insights.map(item => row('Key Insights', item.label, item.value))
  ];
};

const analyticsCsv = (snapshot, generatedAt) => `\uFEFF${[ANALYTICS_HEADERS.join(','), ...analyticsRows(snapshot, generatedAt).map(row => row.map(csvCell).join(','))].join('\r\n')}\r\n`;
const createAnalyticsWorkbook = (snapshot, generatedAt = new Date()) => {
  const rows = analyticsRows(snapshot, generatedAt);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'STI Vio-Log'; workbook.created = generatedAt;
  for (const section of ANALYTICS_SECTIONS) {
    const sheet = workbook.addWorksheet(section, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = ANALYTICS_HEADERS.map((header, index) => ({ header, width: [26, 32, 14, 14, 60, 16][index] }));
    rows.filter(row => row[0] === section).forEach(row => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
  }
  return workbook;
};

const exportAnalytics = async (req, res) => {
  try {
    assertAllowedFields(req.query, []);
    const snapshot = validateAnalyticsSnapshot(req.body);
    const format = req.path.endsWith('.xlsx') ? 'xlsx' : 'csv';
    const generatedAt = new Date();
    const contents = format === 'xlsx' ? Buffer.from(await createAnalyticsWorkbook(snapshot, generatedAt).xlsx.writeBuffer()) : analyticsCsv(snapshot, generatedAt);
    res.setHeader('Content-Type', format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="STI_Vio-Log_Analytics_${snapshot.range.from}_${snapshot.range.to}.${format}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(contents);
  } catch (error) {
    return fail(res, error, 'Failed to export analytics. Please try again.');
  }
};

// Violation Report
const loadViolationReport = async (req) => {
  assertAllowedFields(req.query, ['status', 'student_id', 'sort_by', 'from_date', 'to_date', 'search']);
  const { query, params } = violationQuery(req.query);
  const result = await pool.query(query, params);

  return {
    success: true,
    report_type: 'violations',
    total_records: result.rows.length,
    data: result.rows,
    generated_at: new Date().toISOString()
  };
};
const getViolationReport = async (req, res) => {
  try { return res.json(await loadViolationReport(req)); } catch (error) {
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
    const payload = await loadViolationReport(req), generatedAt = new Date();
    const buffer = await createReportWorkbook('violations', payload, req.query, generatedAt).xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFilename('violations', generatedAt)}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) { return fail(res, error, 'Failed to export violation report'); }
};

// Community Service Report
const loadCommunityServiceReport = async (req) => {
  assertAllowedFields(req.query, ['status', 'student_id', 'sort_by']);
  const { status, student_id, sort_by } = req.query;
  validateId(student_id);
  if (status && !reportStatusOptions('community-service').includes(status)) bad('Unsupported report status');
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

  return {
    success: true,
    report_type: 'community_service',
    total_records: result.rows.length,
    total_pending_hours: result.rows.filter((row) => ['OPEN', 'IN_PROGRESS'].includes(row.status)).reduce((sum, row) => sum + Number(row.remaining_hours || 0), 0),
    data: result.rows,
    generated_at: new Date().toISOString()
  };
};
const getCommunityServiceReport = async (req, res) => {
  try { return res.json(await loadCommunityServiceReport(req)); } catch (error) {
    console.error('Community service report error:', error);
    return fail(res, error, 'Failed to generate community service report');
  }
};

// Non-Compliance Report
const loadNonComplianceReport = async (req) => {
  assertAllowedFields(req.query, ['sort_by']);
  const { sort_by } = req.query;
  if (sort_by && !['date', 'hours', 'violations'].includes(sort_by)) {
    bad('sort_by must be date, hours, or violations');
  }
  const departmentScoped = req.user.role === 'DEPARTMENT_HEAD';

  const query = `
    SELECT
      s.first_name,
      s.last_name,
      s.student_number,
      s.academic_level,
      s.strand,
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
    GROUP BY s.id, s.first_name, s.last_name, s.student_number, s.academic_level, s.strand, s.program, s.year_level
    HAVING COUNT(DISTINCT CASE WHEN v.status = 'OPEN' THEN v.id END) > 0
    ORDER BY ${sort_by === 'hours' ? 'pending_hours DESC' : sort_by === 'violations' ? 'open_violations DESC' : 'last_violation_date DESC'}
  `;

  const result = await pool.query(query, departmentScoped ? [req.user.department_id] : []);

  return {
    success: true,
    report_type: 'non_compliance',
    total_non_compliant_students: result.rows.length,
    data: result.rows,
    generated_at: new Date().toISOString()
  };
};
const getNonComplianceReport = async (req, res) => {
  try { return res.json(await loadNonComplianceReport(req)); } catch (error) {
    console.error('Non-compliance report error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to generate non-compliance report'
    });
  }
};

module.exports = { loadViolationReport, loadCommunityServiceReport, loadNonComplianceReport,
  exportAnalytics,
  analyticsCsv,
  createAnalyticsWorkbook,
  validateAnalyticsSnapshot,
  getViolationReport,
  exportViolationReportCsv,
  exportViolationReportXlsx,
  getCommunityServiceReport,
  getNonComplianceReport,
  violationCsv,
  violationQuery,
  createViolationWorkbook,
  createReportWorkbook
};
