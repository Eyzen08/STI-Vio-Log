const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const express = require('express');
const pool = require('../src/config/database');
const sessions = require('../src/services/browserSessionService');
const reports = require('../src/controllers/reportController');
const routes = require('../src/routes/reportRoutes');

const snapshot = () => ({
  range: { from: '2026-10-01', to: '2026-10-07', previousFrom: '2026-09-01', previousTo: '2026-09-07' },
  program: 'ALL',
  analytics: {
    violationCount: 2, previousViolationCount: 1,
    trend: [{ from: '2026-10-01', to: '2026-10-02', count: 0 }, { from: '2026-10-03', to: '2026-10-04', count: 0 }, { from: '2026-10-05', to: '2026-10-06', count: 1 }, { from: '2026-10-07', to: '2026-10-07', count: 1 }],
    classifications: [{ level: 'MINOR_1', label: 'First offense', count: 0 }, { level: 'MINOR_2', label: 'Repeat minor', count: 0 }, { level: 'MAJOR_LEVEL', label: 'Major level', count: 0 }, { level: 'GRAVE', label: 'Grave', count: 2 }],
    programs: [{ label: 'BSIT', count: 2 }],
    service: { completed: 1, active: 1, total: 2, completionPercent: 50 }
  },
  insights: [{ label: 'Violation change', value: '↑ 100% violations vs previous period' }, { label: 'Active service', value: '1 assignment' }, { label: 'Service completion', value: '50%' }, { label: 'Overdue assignments', value: 'Data unavailable' }]
});

test('analytics downloads preserve all six sections, typed counts, filters, and Manila generation time', async () => {
  const data = snapshot();
  data.program = '=BSIT, "José"';
  data.analytics.programs[0].label = data.program;
  const now = new Date('2026-10-07T17:05:00Z');
  assert.equal(typeof reports.createAnalyticsWorkbook, 'function');
  const buffer = await reports.createAnalyticsWorkbook(data, now).xlsx.writeBuffer();
  const workbook = await new ExcelJS.Workbook().xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Filters', 'Violations Over Time', 'Classification', 'Community Service', 'Department', 'Key Insights']);
  const filters = workbook.getWorksheet('Filters');
  const headers = [['Setting', 'Value'], ['Period start', 'Period end', 'Recorded violations'], ['Classification', 'Recorded violations'], ['Metric', 'Value', 'Unit'], ['Program / Strand', 'Recorded violations'], ['Insight', 'Value']];
  workbook.worksheets.forEach((sheet, index) => {
    assert.deepEqual(sheet.getRow(6).values.slice(1), headers[index]);
    assert.equal(sheet.views[0].showGridLines, false);
    assert.equal(sheet.views[0].ySplit, 6);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.pageSetup.printTitlesRow, '6:6');
    assert.ok(sheet.pageSetup.printArea);
  });
  assert.equal(filters.getCell('B7').value, data.program);
  assert.equal(filters.getCell('B7').type, ExcelJS.ValueType.String);
  assert.match(filters.getCell('B8').value, /2026-10-01.*2026-10-07/);
  assert.match(filters.getCell('B9').value, /2026-09-01.*2026-09-07/);
  assert.match(filters.getCell('B10').value, /2026-10-08.*01:05/);
  assert.doesNotMatch(JSON.stringify(workbook.worksheets.map(tab=>tab.getSheetValues())), /\b(?:Manila|Asia)\b/i);
  assert.equal(filters.getCell('B11').value, 2);
  assert.equal(filters.getCell('B12').value, 1);
  const trend = workbook.getWorksheet('Violations Over Time');
  assert.equal(trend.getCell('C9').value, 1);
  assert.equal(trend.getCell('C7').value, 0);
  assert.equal(trend.getCell('A7').value.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(workbook.getWorksheet('Classification').getCell('B10').value, 2);
  const service = workbook.getWorksheet('Community Service');
  assert.equal(service.getCell('B10').value, .5);
  assert.equal(service.getCell('B10').numFmt, '0%');
  assert.equal(service.getCell('B11').value, .5);
  assert.equal(workbook.getWorksheet('Department').getCell('A7').value, data.program);
  assert.equal(workbook.getWorksheet('Key Insights').getCell('B7').value, '↑ 100% violations vs previous period');
  assert.equal(workbook.getWorksheet('Key Insights').getCell('B9').value, .5);
  assert.equal(workbook.getWorksheet('Key Insights').getCell('B9').numFmt, '0%');
  const csv = reports.analyticsCsv(data, now);
  assert.ok(csv.startsWith('\uFEFFSection,Metric,From,To,Value,Unit\r\n'));
  assert.match(csv, /"'=BSIT, ""José"""/);
  assert.match(csv, /"Community Service","Completion","2026-10-01","2026-10-07","50","percent"/);
  assert.match(csv, /Overdue data unavailable/);
});

test('analytics export rejects malformed dates, counts, nested records, and spreadsheet objects', () => {
  assert.equal(typeof reports.validateAnalyticsSnapshot, 'function');
  for (const mutate of [
    data => { data.range.from = '2026-02-30'; },
    data => { data.range.to = '2026-09-30'; },
    data => { data.analytics.violationCount = -1; },
    data => { data.analytics.trend[0].count = '2'; },
    data => { data.analytics.service.completionPercent = 101; },
    data => { data.analytics.programs[0].label = { formula: '1+1' }; },
    data => { data.students = [{ student_number: 'private' }]; },
    data => { data.analytics.programs[0].student_number = 'private'; },
    data => { data.insights[0].value = '\u0000invalid'; },
    data => { data.analytics.service = null; }
  ]) {
    const data = snapshot(); mutate(data);
    assert.throws(() => reports.validateAnalyticsSnapshot(data), error => error.statusCode === 400);
  }
});

test('empty analytics export retains zero counts and unavailable labels', async () => {
  const data = snapshot();
  data.analytics.violationCount = 0;
  data.analytics.previousViolationCount = 0;
  data.analytics.trend.forEach(row => { row.count = 0; });
  data.analytics.classifications.forEach(row => { row.count = 0; });
  data.analytics.programs = [];
  data.analytics.service = { completed: 0, active: 0, total: 0, completionPercent: 0 };
  data.insights[0].value = 'No violations in either period';
  data.insights[1].value = '0 assignments';
  data.insights[2].value = 'No assignments';
  assert.equal(typeof reports.analyticsCsv, 'function');
  const csv = reports.analyticsCsv(data);
  assert.match(csv, /No records for this selection/);
  assert.match(csv, /No assignments/);
  assert.match(csv, /"Total assignments","2026-10-01","2026-10-07","0","assignments"/);
  const workbook = await new ExcelJS.Workbook().xlsx.load(await reports.createAnalyticsWorkbook(data).xlsx.writeBuffer());
  assert.equal(workbook.getWorksheet('Department').getCell('A7').value, 'No records for this selection.');
  assert.equal(workbook.getWorksheet('Department').getCell('B7').value, 0);
  assert.equal(workbook.getWorksheet('Community Service').getCell('B12').value, 'Overdue data unavailable');
  assert.equal(workbook.getWorksheet('Community Service').getCell('B13').value, 'No assignments');
  assert.equal(workbook.getWorksheet('Key Insights').getCell('B9').value, 'No assignments');
});

test('exports accept actual dashboard snapshots across program filters, periods, and Manila midnight', async () => {
  const { analyticsForRange, analyticsInsights, periodRange } = await import('../../frontend/src/lib/dashboardAnalytics.js');
  const students = [{ id: 1, program: 'BSIT' }, { id: 2, strand: 'STEM' }];
  const violations = [{ student_id: 1, incident_date: '2026-10-01', offense_indicator_level: 'MINOR_1' }, { student_id: 2, incident_date: '2026-10-06', offense_indicator_level: 'GRAVE' }, { student_id: 1, incident_date: '2026-09-05', offense_indicator_level: 'MINOR_1' }];
  const assignments = [{ student_id: 1, assigned_at: '2026-09-30T17:00:00Z', status: 'COMPLETED' }];
  for (const [period, program, current, previous, completed] of [
    ['THIS_MONTH', 'ALL', 2, 1, 1], ['THIS_MONTH', 'BSIT', 1, 1, 1],
    ['THIS_MONTH', 'STEM', 1, 0, 0], ['LAST_MONTH', 'ALL', 1, 0, 0],
    ['THIS_YEAR', 'ALL', 3, 0, 1], ['CUSTOM', 'ALL', 1, 0, 1]
  ]) {
    const range = periodRange(period, '2026-10-07', '2026-10-01', '2026-10-01');
    const analytics = analyticsForRange({ students, violations, assignments, range, program });
    const csv = reports.analyticsCsv({ range, program, analytics, insights: analyticsInsights(analytics) });
    assert.ok(csv.includes(`"Current violations","${range.from}","${range.to}","${current}","violations"`));
    assert.ok(csv.includes(`"Previous violations","${range.previousFrom}","${range.previousTo}","${previous}","violations"`));
    assert.ok(csv.includes(`"Completed","${range.from}","${range.to}","${completed}","assignments"`));
  }
});

test('both analytics routes enforce session, CSRF, permissions and audit without snapshot contents', async () => {
  const originalQuery = pool.query;
  const events = [];
  pool.query = async (sql, params) => {
    if (sql.includes('FROM browser_sessions')) return { rows: [{ id: 1, username: 'admin', email_verified: true, role: params[0] === sessions.hash('student') ? 'STUDENT' : params[0] === sessions.hash('head') ? 'DEPARTMENT_HEAD' : params[0] === sessions.hash('office') ? 'DISCIPLINE_OFFICE' : 'DISCIPLINE_ADMIN', browser_session_id: 1, csrf_hash: sessions.hash('csrf', process.env.CSRF_SIGNING_KEY) }] };
    if (sql.includes('INSERT INTO administrative_security_events')) events.push(params);
    return { rows: [] };
  };
  const app = express(); app.use(express.json()); app.use('/api/reports', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/reports`;
  const request = (format, token, csrf = 'csrf') => fetch(`${base}/analytics.${format}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `sti_session=${token}; sti_csrf=csrf`, 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify(snapshot())
  });
  try {
    for (const format of ['csv', 'xlsx']) {
      const anonymous = await request(format); await anonymous.arrayBuffer();
      assert.equal(anonymous.status, 401);
      const invalidCsrf = await request(format, 'admin', 'wrong'); await invalidCsrf.arrayBuffer();
      assert.equal(invalidCsrf.status, 403);
      const head = await request(format, 'head'); await head.arrayBuffer();
      assert.equal(head.status, 403);
      const student = await request(format, 'student'); await student.arrayBuffer();
      assert.equal(student.status, 403);
      for (const role of ['admin', 'office']) {
        const response = await request(format, role);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-disposition'), `attachment; filename="STI_Vio-Log_Analytics_2026-10-01_2026-10-07.${format}"`);
        assert.match(response.headers.get('content-type'), format === 'csv' ? /text\/csv/ : /spreadsheetml/);
        const contents = Buffer.from(await response.arrayBuffer());
        assert.ok(contents.length > 0);
        if (format === 'xlsx') assert.equal(contents.subarray(0, 2).toString(), 'PK');
      }
      const invalid = await fetch(`${base}/analytics.${format}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sti_session=admin; sti_csrf=csrf', 'X-CSRF-Token': 'csrf' }, body: JSON.stringify({ ...snapshot(), students: [] }) });
      assert.equal(invalid.status, 400);
      assert.match((await invalid.json()).message, /Unsupported field/);
    }
    const exports = events.filter(event => event[4] === 'SENSITIVE_DATA_EXPORT');
    assert.equal(exports.length, 6);
    assert.equal(exports.filter(event => event[13] === 'SUCCESS').length, 4);
    assert.equal(exports.filter(event => event[13] === 'FAILED').length, 2);
    assert.doesNotMatch(JSON.stringify(exports), /BSIT|violationCount|completionPercent/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
  }
});
