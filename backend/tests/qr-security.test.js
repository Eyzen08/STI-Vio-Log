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

test('manual Student Number lookup resolves the exact student and reports the verification method', async () => {
  const originalQuery = database.query;
  const queries = [];
  database.query = async (sql, params) => {
    queries.push({ sql: String(sql), params });
    if (String(sql).includes('WHERE s.student_number=$1')) return { rows: [{ id: 40, student_number: '02000123456', first_name: 'Test', last_name: 'Student' }] };
    if (String(sql) === 'SELECT clock_timestamp() AS now') return { rows: [{ now: new Date('2026-10-08T01:00:00Z') }] };
    if (String(sql).includes('SUM(COALESCE(invalidated_allowance_minutes,credited_minutes))')) return { rows: [{ minutes: 0 }] };
    return { rows: [] };
  };
  try {
    const res = response();
    await scanQrCode({ user: { id: 1, role: 'DISCIPLINE_ADMIN' }, body: { student_number: '02000123456' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.student.id, 40);
    assert.equal(res.body.identification_method, 'STUDENT_NUMBER');
    const lookup = queries.find(({ sql }) => sql.includes('WHERE s.student_number=$1'));
    assert.deepEqual(lookup.params, ['02000123456']);
    assert.match(lookup.sql, /JOIN users u ON u\.id=s\.user_id/);
    assert.match(lookup.sql, /u\.is_active=TRUE/);
    assert.equal(queries.some(({ sql }) => sql.includes('WHERE s.qr_code=$1')), false);
  } finally { database.query = originalQuery; }
});

test('manual Student Number input requires exactly one recorded identifier', async () => {
  for (const body of [
    { student_number: '0200012345A' },
    { student_number: '02000 123456' },
    { student_number: '0'.repeat(33) },
    { student_number: '02000123456', qr_code: 'QR-40' },
    {}
  ]) {
    const res = response();
    await scanQrCode({ user: { role: 'DISCIPLINE_ADMIN' }, body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.body.success, false);
  }
});

test('manual lookup accepts legacy Student Numbers that predate the 11-digit rule', async () => {
  const originalQuery = database.query;
  const lookedUp = [];
  database.query = async (sql, params) => {
    if (String(sql).includes('WHERE s.student_number=$1')) {
      lookedUp.push(params[0]);
      return { rows: [{ id: 41, student_number: params[0], first_name: 'Legacy', last_name: 'Student' }] };
    }
    if (String(sql) === 'SELECT clock_timestamp() AS now') return { rows: [{ now: new Date('2026-10-08T01:00:00Z') }] };
    if (String(sql).includes('SUM(COALESCE(invalidated_allowance_minutes,credited_minutes))')) return { rows: [{ minutes: 0 }] };
    return { rows: [] };
  };
  try {
    for (const number of ['024726481947', '0209090909', '2024-001']) {
      const res = response();
      await scanQrCode({ user: { id: 1, role: 'DISCIPLINE_ADMIN' }, body: { student_number: number } }, res);
      assert.equal(res.statusCode, 200, number);
      assert.equal(res.body.student.student_number, number);
      assert.equal(res.body.identification_method, 'STUDENT_NUMBER');
    }
    assert.deepEqual(lookedUp, ['024726481947', '0209090909', '2024-001']);
  } finally { database.query = originalQuery; }
});

test('admin and department staff can verify a completed student without a client department', async () => {
  const originalQuery = database.query;
  database.query = async (sql) => {
    if (String(sql).includes('officer_department_assignments')) return {rows:[{id:5}]};
    if (String(sql).includes('WHERE s.qr_code=$1')) return {rows:[{id:40,first_name:'Test',last_name:'Student'}]};
    if (String(sql)==='SELECT clock_timestamp() AS now') return {rows:[{now:new Date('2026-10-08T01:00:00Z')}]};
    if (String(sql).includes('SUM(COALESCE(invalidated_allowance_minutes,credited_minutes))')) return {rows:[{minutes:0}]};
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
      assert.equal(res.body.identification_method,'QR_CODE');
    }
  } finally { database.query=originalQuery; }
});
