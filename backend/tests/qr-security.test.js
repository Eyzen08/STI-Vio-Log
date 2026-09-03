const test = require('node:test');
const assert = require('node:assert/strict');

const database = require('../src/config/database');
const { requireAuthorizedDepartment } = require('../src/middleware/authMiddleware');
const { scanQrCode } = require('../src/controllers/qrController');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('disabled Department Head scanner permission is denied from current database state', async () => {
  const originalQuery = database.query;
  let query;
  database.query = async (sql, params) => { query = { sql: String(sql), params }; return { rows: [] }; };
  try {
    const req = { user: { id: 12, role: 'DEPARTMENT_HEAD', department_id: 5 }, body: {} };
    const res = response();
    let continued = false;
    await requireAuthorizedDepartment(req, res, () => { continued = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);
    assert.match(query.sql, /qr_scanner_enabled = TRUE/);
    assert.deepEqual(query.params, [12, 5]);
  } finally { database.query = originalQuery; }
});

test('QR input rejects non-string, oversized, and unsupported request data', async () => {
  for (const body of [
    { qr_code: 42 },
    { qr_code: 'x'.repeat(257) },
    { qr_code: 'valid', notes: 'x'.repeat(501) },
    { qr_code: 'valid', student_id: 9 }
  ]) {
    const res = response();
    await scanQrCode({ user: { role: 'DEPARTMENT_HEAD' }, staffDepartmentId: 5, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('QR verification requires an active linked student account', async () => {
  const originalQuery = database.query;
  let studentSql = '';
  database.query = async (sql) => { studentSql = String(sql); return { rows: [] }; };
  try {
    const res = response();
    await scanQrCode({ user: { role: 'DEPARTMENT_HEAD' }, staffDepartmentId: 5, body: { qr_code: 'opaque-code' } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(studentSql, /JOIN users u ON u\.id=s\.user_id/);
    assert.match(studentSql, /u\.is_active=TRUE/);
  } finally { database.query = originalQuery; }
});
