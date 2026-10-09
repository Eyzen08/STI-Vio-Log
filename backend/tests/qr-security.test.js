const test = require('node:test');
const assert = require('node:assert/strict');

const database = require('../src/config/database');
const { requireAuthorizedDepartment } = require('../src/middleware/authMiddleware');
const { scanQrCode } = require('../src/controllers/qrController');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('office roles authorize stored service departments independently of their profile assignment', async () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
    const calls = [];
    const client = { query: async (sql, params) => {
      calls.push({ sql: String(sql), params });
      return { rows: [{ department_id: 9, id: 9 }] };
    } };
    const req = { user: { id: 12, role, department_id: 5 }, body: { assignment_id: 8 } };
    const res = response();
    let allowed = false;
    await requireAuthorizedDepartment(req, res, () => { allowed = true; }, client);
    assert.equal(allowed, true, role);
    assert.equal(req.staffDepartmentId, 9);
    assert.deepEqual(calls.at(-1).params, [9]);
    assert.doesNotMatch(calls.at(-1).sql, /officer_department_assignments/);

    const mismatch = response();
    await requireAuthorizedDepartment({ ...req, body: { assignment_id: 8, department_id: 10 } }, mismatch,
      () => assert.fail('mismatched department accepted'), client);
    assert.equal(mismatch.statusCode, 403);
  }
});

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
    assert.match(query.sql, /qr_scanner_enabled/);
    assert.match(query.sql, /officer_department_assignments/);
    assert.deepEqual(query.params, [12, 5, 'DEPARTMENT_HEAD']);
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
  database.query = async (sql) => { if(String(sql).includes('officer_department_assignments')) return {rows:[{id:5}]}; studentSql = String(sql); return { rows: [] }; };
  try {
    const res = response();
    await scanQrCode({ user: { id:12,role: 'DEPARTMENT_HEAD',department_id:5 }, staffDepartmentId: 5, body: { qr_code: 'opaque-code' } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(studentSql, /JOIN users u ON u\.id=s\.user_id/);
    assert.match(studentSql, /u\.is_active=TRUE/);
  } finally { database.query = originalQuery; }
});

test('admin and department staff can verify a completed student without a client department', async () => {
  const originalQuery = database.query;
  database.query = async (sql) => {
    if (String(sql).includes('officer_department_assignments')) return {rows:[{id:5}]};
    if (String(sql).includes('WHERE s.qr_code=$1')) return {rows:[{id:40,first_name:'Test',last_name:'Student'}]};
    if (String(sql)==='SELECT clock_timestamp() AS now') return {rows:[{now:new Date('2026-10-08T01:00:00Z')}]};
    if (String(sql).includes('SUM(credited_minutes)')) return {rows:[{minutes:0}]};
    return {rows:[]};
  };
  try {
    for (const user of [{id:1,role:'DISCIPLINE_ADMIN'},{id:12,role:'DEPARTMENT_HEAD',department_id:5}]) {
      const res=response();
      await scanQrCode({user,body:{qr_code:'completed-student'}},res);
      assert.equal(res.statusCode,200);
      assert.equal(res.body.success,true);
      assert.equal(res.body.student.id,40);
      assert.equal(res.body.assignment,null);
      assert.equal(res.body.student_status,'No active service requirement');
      assert.equal(res.body.allowance.available_minutes,0);
    }
  } finally { database.query=originalQuery; }
});
