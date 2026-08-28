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
