const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/auditRoutes');
const { createAuditController, sanitizeAuditDescription } = require('../src/controllers/auditController');
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('audit routes expose read-only list and statistics contracts', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, ['GET /', 'GET /stats']);
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
