const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/auditRoutes');
const { createAuditController, sanitizeAuditDescription } = require('../src/controllers/auditController');
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('audit routes expose read-only list and statistics contracts', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, ['GET /', 'GET /stats', 'GET /export.xlsx']);
});

test('audit Excel export includes all filtered events with safe readable cells and metadata', async () => {
  const ExcelJS = require('exceljs');
  const queries = [];
  const rows = Array.from({ length: 31 }, (_, index) => ({ id: String(100 - index), action: 'TIME_OUT_CREDITED', table_name: 'future_records', record_id: 8, actor_name: '=HYPERLINK("bad")', actor_username: 'officer', recorded_actor_role: 'DEPARTMENT_HEAD', created_at: '2026-10-07T16:01:00Z', target_label: 'Archived record #8', description: JSON.stringify({ attendance_outcome: 'LEFT_EARLY', credited_minutes: 0, supervisor_changed: false, reason: 'token=private', changes: { required_service_hours: { before: 2, after: 0 }, password: { after: 'hidden-password' } } }) }));
  const controller = createAuditController({ database: { async query(sql, params) { queries.push({ sql, params: [...params] }); return { rows }; } }, now: () => new Date('2026-10-07T16:30:00Z') });
  assert.equal(typeof controller.exportAuditLogs, 'function');
  const res = { ...response(), headers: {}, setHeader(name, value) { this.headers[name] = value; }, send(body) { this.body = body; return this; } };
  await controller.exportAuditLogs({ query: { action: 'time_out_credited', from_date: '2026-10-08', to_date: '2026-10-08' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /spreadsheetml/);
  assert.match(res.headers['Content-Disposition'], /STI_Vio-Log_Audit_Log_2026-10-08.xlsx/);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(queries[0].sql, /LIMIT|OFFSET/);
  assert.match(queries[0].sql, /ORDER BY al.created_at DESC, al.id DESC/);
  assert.deepEqual(queries[0].params, ['TIME_OUT_CREDITED', '2026-10-08T00:00:00+08:00', '2026-10-09T00:00:00+08:00']);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(res.body);
  const sheet = workbook.getWorksheet('Audit Log');
  assert.equal(sheet.getCell('B4').value, 31);
  assert.match(sheet.getCell('A2').value, /Oct 8, 2026.*12:30 AM/);
  assert.match(sheet.getCell('A3').value, /Time Out Credited.*2026-10-08/);
  assert.equal(sheet.getRow(37).getCell(1).value, '70');
  assert.equal(sheet.getCell('C7').value, '=HYPERLINK("bad")');
  assert.equal(sheet.getCell('C7').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('D7').value, 'Department Head');
  assert.equal(sheet.getCell('F7').value, 'Archived record #8');
  assert.match(sheet.getCell('J7').value, /Timed out early; 0 minutes credited/);
  assert.match(sheet.getCell('K7').value, /Supervisor changed: No/);
  assert.match(sheet.getCell('K7').value, /Required Service Hours: 2 hr → 0 min/);
  assert.doesNotMatch(JSON.stringify(sheet.getSheetValues()), /private|hidden-password/);
  assert.equal(sheet.views[0].ySplit, 6);
  assert.equal(sheet.views[0].xSplit, 3);
  assert.equal(sheet.views[0].showGridLines, false);
  assert.equal(sheet.pageSetup.printArea, 'A1:K37');
  assert.equal(sheet.pageSetup.printTitlesRow, '6:6');
  assert.equal(sheet.pageSetup.printTitlesColumn, 'A:C');
  assert.equal(sheet.pageSetup.fitToPage, false);
  assert.equal(sheet.getCell('A6').font.name, 'Arial');
  assert.equal(sheet.getCell('A6').fill.fgColor.argb, 'FF123553');
  assert.equal(sheet.getCell('B4').alignment.horizontal, 'right');
  assert.ok(sheet.getRow(7).height > 24);
  assert.ok(sheet.autoFilter);
  assert.equal(sheet.getCell('K7').alignment.wrapText, true);
});

test('Excel export rejects pagination and invalid dates before querying and reports query failures', async () => {
  let queries = 0;
  const controller = createAuditController({ database: { async query() { queries++; throw new Error('private database failure'); } } });
  assert.equal(typeof controller.exportAuditLogs, 'function');
  for (const query of [{ page: '2' }, { from_date: '2026-02-30' }, { from_date: '2026-10-09', to_date: '2026-10-08' }]) {
    const res = response(); await controller.exportAuditLogs({ query }, res); assert.equal(res.statusCode, 400);
  }
  assert.equal(queries, 0);
  const failed = response(); await controller.exportAuditLogs({ query: {} }, failed);
  assert.equal(failed.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(failed.body), /private database failure/);
});

test('unfiltered Excel export batches context, preserves text identifiers, legacy time and missing records', async () => {
  const ExcelJS = require('exceljs');
  const calls = [];
  const controller = createAuditController({ database: { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FROM audit_logs al LEFT JOIN')) return { rows: [
      { id: 3, table_name: 'clearance_certificates', record_id: 5, action: 'CERTIFICATE_EMAIL_SENT', description: 'Re-sent certificate to registered student email', created_at: '2026-10-07T15:59:59Z' },
      { id: 2, table_name: 'community_service_sessions', record_id: 20, action: 'TIME_OUT_CREDITED', description: '{"worked_minutes":438,"credited_minutes":438,"limit_reached":true}', created_at: '2026-10-07T15:59:59Z' },
      { id: 1, table_name: 'violations', record_id: 99, action: 'COMPLETE', description: '{"from_status":"OPEN","to_status":"COMPLETED"}', created_at: '2026-10-07T15:59:58Z' }
    ] };
    if (sql.includes('FROM clearance_certificates')) return { rows: [{ record_id: 5, subject_name: '+Juan Santos', subject_identifier: '000123', certificate_number: 'STI-CGC-5' }] };
    if (sql.includes('FROM community_service_sessions')) return { rows: [{ record_id: 20, subject_name: '@Juan Santos', subject_identifier: '000123', department_name: 'Library', violation_label: 'Major Offense' }] };
    return { rows: [] };
  } } });
  const res = { ...response(), setHeader() {}, send(body) { this.body = body; return this; } };
  await controller.exportAuditLogs({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0].params, []); assert.doesNotMatch(calls[0].sql, /WHERE|LIMIT|OFFSET/);
  assert.equal(calls.length, 4);
  const sheet = (await new ExcelJS.Workbook().xlsx.load(res.body)).getWorksheet('Audit Log');
  assert.equal(sheet.getCell('A3').value, 'Filters: All activities');
  assert.equal(sheet.getCell('B4').value, 3);
  assert.match(sheet.getCell('B7').value, /Oct 7, 2026.*11:59 PM/);
  assert.equal(sheet.getCell('G7').value, '+Juan Santos');
  assert.equal(sheet.getCell('G8').value, '@Juan Santos');
  assert.equal(sheet.getCell('H7').value, '000123'); assert.equal(sheet.getCell('H7').numFmt, '@');
  assert.match(sheet.getCell('F7').value, /Clearance certificate #5\nSTI-CGC-5/);
  assert.match(sheet.getCell('F8').value, /Major Offense/);
  assert.equal(sheet.getCell('I8').value, 'Library');
  assert.match(sheet.getCell('J8').value, /7 hr 18 min credited/);
  assert.match(sheet.getCell('K8').value, /Worked time: 7 hr 18 min/);
  assert.equal(sheet.getCell('F9').value, 'Violation #99');
  assert.match(sheet.getCell('J9').value, /Open to Completed/);
  const { createAuditWorkbook } = require('../src/services/auditExport');
  const empty = (await new ExcelJS.Workbook().xlsx.load(await createAuditWorkbook([]).xlsx.writeBuffer())).getWorksheet('Audit Log');
  assert.equal(empty.getCell('B4').value, 0); assert.equal(empty.rowCount, 6);
});

test('Excel route requires a session, audit view and DATA_EXPORT and audits success and failure', async () => {
  const express = require('express');
  const pool = require('../src/config/database');
  const sessions = require('../src/services/browserSessionService');
  const { authenticateToken } = require('../src/middleware/authMiddleware');
  const originalQuery = pool.query, events = [];
  let selections = 0;
  pool.query = async (sql, params) => {
    if (sql.includes('FROM browser_sessions')) return { rows: [{ id: 1, username: 'admin', email_verified: true, role: params[0] === sessions.hash('student') ? 'STUDENT' : params[0] === sessions.hash('head') ? 'DEPARTMENT_HEAD' : params[0] === sessions.hash('office') ? 'DISCIPLINE_OFFICE' : 'DISCIPLINE_ADMIN', browser_session_id: 1 }] };
    if (sql.includes('INSERT INTO administrative_security_events')) events.push(params);
    if (sql.includes('FROM audit_logs al LEFT JOIN')) selections++;
    return { rows: [] };
  };
  const app = express();
  app.use('/api/audit-logs', authenticateToken, (req, _res, next) => {
    // Exercise independent permission requirements, even for custom admin scopes.
    if (req.headers.cookie === 'sti_session=view-only') req.user.permissions = ['OPERATIONAL_AUDIT_VIEW'];
    if (req.headers.cookie === 'sti_session=technical-only') req.user.permissions = ['TECHNICAL_AUDIT_VIEW'];
    if (req.headers.cookie === 'sti_session=export-only') req.user.permissions = ['DATA_EXPORT'];
    next();
  }, router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/audit-logs/export.xlsx`;
  try {
    for (const token of [undefined, 'student', 'head', 'office', 'view-only', 'technical-only', 'export-only']) {
      const res = await fetch(base, { headers: token ? { Cookie: `sti_session=${token}` } : {} });
      await res.arrayBuffer(); assert.equal(res.status, token ? 403 : 401);
    }
    assert.equal(selections, 0);
    const success = await fetch(`${base}?action=TIME_IN&user_id=9&table_name=violations`, { headers: { Cookie: 'sti_session=admin' } });
    assert.equal(success.status, 200); assert.equal(Buffer.from(await success.arrayBuffer()).subarray(0, 2).toString(), 'PK');
    const invalid = await fetch(`${base}?page=2`, { headers: { Cookie: 'sti_session=admin' } });
    await invalid.arrayBuffer(); assert.equal(invalid.status, 400);
    const exports = events.filter(event => event[4] === 'SENSITIVE_DATA_EXPORT');
    assert.equal(exports.length, 2);
    assert.deepEqual(exports.map(event => event[13]), ['SUCCESS', 'FAILED']);
    assert.doesNotMatch(JSON.stringify(exports), /TIME_IN|user_id|table_name/);
    assert.equal(selections, 1);
  } finally { await new Promise(resolve => server.close(resolve)); pool.query = originalQuery; }
});

test('audit descriptions redact authentication and Google identity values', () => {
  const value = sanitizeAuditDescription('password=secret token:abc google_email=user@example.com google_sub=123');
  assert.equal(value.includes('secret'), false); assert.equal(value.includes('user@example.com'), false); assert.equal(value.includes('123'), false);
});

test('audit list paginates and omits IP addresses', async () => {
  const queries = [];
  const controller = createAuditController({ database: { async query(sql, params) { queries.push({ sql, params }); if (sql.includes('COUNT')) return { rows: [{ total: 1 }] }; return { rows: [{ id: 1, user_id: 2, action: 'LOGIN', description: 'token=private', ip_address: '127.0.0.1', password_hash: 'never-return' }] }; } } });
  const res = response();
  await controller.getAuditLogs({ query: { page: '1', limit: '25' } }, res);
  assert.equal(res.body.pagination.total, 1); assert.equal(res.body.audit_logs[0].ip_address, undefined); assert.equal(res.body.audit_logs[0].password_hash, undefined); assert.equal(res.body.audit_logs[0].description, '[REDACTED]'); assert.match(queries[1].sql, /LIMIT \$1 OFFSET \$2/);
});

test('structured audit descriptions redact nested secrets and quoted credentials', () => {
  const clean = sanitizeAuditDescription(JSON.stringify({ reason: 'token=private', changes: { password: { before: 'old-secret', after: 'new-secret' } }, google_email: 'private@example.com', credited_minutes: 0 }));
  assert.doesNotMatch(clean, /private|old-secret|new-secret/);
  assert.equal(JSON.parse(clean).credited_minutes, 0);
  assert.doesNotMatch(sanitizeAuditDescription('{"password":"secret"'), /secret/);
});

test('audit list enriches a page in batches and keeps historical roles and safe changes', async () => {
  const calls = [];
  const controller = createAuditController({ database: { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 2 }] };
    if (sql.includes('SELECT DISTINCT')) return { rows: [{ action: 'TIME_IN', table_name: 'community_service_sessions' }, { action: 'TIME_IN', table_name: 'community_service_sessions' }] };
    if (sql.includes('FROM audit_logs al LEFT JOIN')) return { rows: [24, 25].map((id) => ({ id, record_id: id, table_name: 'community_service_sessions', user_id: 9, actor_name: 'Ana Cruz', actor_role: 'DISCIPLINE_ADMIN', recorded_actor_role: 'DEPARTMENT_HEAD', description: JSON.stringify({ credited_minutes: 0, password: 'never-return', changes: { required_service_hours: { before: 2, after: 0 }, token: { before: 'private' } } }), reason: 'token=private' })) };
    return { rows: [{ record_id: 24, subject_name: 'Juan Santos', subject_identifier: '2026-001', department_name: 'Library' }] };
  } } });
  const res = response();
  await controller.getAuditLogs({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.audit_logs[0].actor_role, 'DEPARTMENT_HEAD');
  assert.equal(res.body.audit_logs[0].record_context.subject_name, 'Juan Santos');
  assert.equal(res.body.audit_logs[1].record_context.subject_name, undefined);
  assert.equal(res.body.audit_logs[0].details.credited_minutes, 0);
  assert.deepEqual(res.body.audit_logs[0].details.changes, { required_service_hours: { before: 2, after: 0 } });
  assert.doesNotMatch(JSON.stringify(res.body), /never-return|private/);
  assert.deepEqual(res.body.filter_options, { actions: ['TIME_IN'], record_types: ['community_service_sessions'] });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[3].params, [['24', '25']]);
});

test('audit calendar dates use inclusive Manila days and reject invalid ranges', async () => {
  const queries = [];
  const controller = createAuditController({ database: { async query(sql, params) { queries.push({ sql, params: [...params] }); return { rows: sql.includes('COUNT(*)') ? [{ total: 0 }] : [] }; } } });
  const res = response();
  await controller.getAuditLogs({ query: { from_date: '2026-10-08', to_date: '2026-10-08' } }, res);
  assert.deepEqual(queries[0].params, ['2026-10-08T00:00:00+08:00', '2026-10-09T00:00:00+08:00']);
  assert.match(queries[0].sql, /al.created_at < \$2/);
  for (const query of [{ from_date: '2026-02-30' }, { from_date: '2026-10-09', to_date: '2026-10-08' }]) {
    const invalid = response();
    await controller.getAuditLogs({ query }, invalid);
    assert.equal(invalid.statusCode, 400);
  }
});

test('audit metadata parses full events, uses recorded changes, and omits unapproved fields', () => {
  const { auditDetails } = require('../src/services/auditPresentation');
  const row = { description: JSON.stringify({ padding: 'x'.repeat(1500), actor_role: 'DEPARTMENT_HEAD', credited_minutes: 0, changes: { completed_service_hours: { before: 1, after: 2 }, password_hash: { after: 'secret' } } }), previous_values: { completed_service_hours: 2 }, new_values: { completed_service_hours: 0 } };
  assert.equal(auditDetails(row).actor_role, 'DEPARTMENT_HEAD');
  assert.deepEqual(auditDetails(row).changes, { completed_service_hours: { before: 2, after: 0 } });
  assert.doesNotMatch(sanitizeAuditDescription(row.description), /padding|secret|password_hash/);
});

test('legacy audit roles and saved labels survive missing or unknown target records', async () => {
  let calls = 0;
  const controller = createAuditController({ database: { async query(sql) {
    calls++;
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
    if (sql.includes('SELECT DISTINCT')) return { rows: [] };
    return { rows: [{ id: 1, table_name: '__proto__', record_id: 7, target_label: 'Archived record #7', actor_role: 'STUDENT', description: '{"actor_role":"DEPARTMENT_HEAD"}' }] };
  } } });
  const res = response();
  await controller.getAuditLogs({ query: {} }, res);
  assert.equal(res.body.audit_logs[0].actor_role, 'DEPARTMENT_HEAD');
  assert.deepEqual(res.body.audit_logs[0].record_context, { label: 'Archived record #7' });
  assert.equal(calls, 3);
});
