const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { approveCertificateStudent } = require('../src/controllers/clearanceCertificateController');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const runWithClient = async (query, body = {}, studentId = '7') => {
  const originalConnect = pool.connect;
  pool.connect = async () => ({ query, release() {} });
  try {
    const res = response();
    await approveCertificateStudent({ params: { studentId }, body, user: { id: 3 }, ip: '127.0.0.1' }, res);
    return res;
  } finally { pool.connect = originalConnect; }
};

const eligibleStudent = { id: 7, student_number: '02090090909', first_name: 'Pedro', last_name: 'Makisig', is_active: true, has_open_violation: false, assignment_count: 1, service_complete: true };

test('student-level approval creates and approves a missing clearance record', async () => {
  const queries = [];
  const res = await runWithClient(async (sql, params) => {
    const text = String(sql); queries.push({ text, params });
    if (text.includes('FROM students s JOIN users')) return { rows: [eligibleStudent] };
    if (text.includes('FROM student_clearance WHERE')) return { rows: [] };
    if (text.includes('INSERT INTO student_clearance')) return { rows: [{ id: 91, student_id: 7, academic_year: params[1], semester: params[2], status: 'PENDING' }] };
    if (text.includes('UPDATE student_clearance SET')) return { rows: [{ id: 91, student_id: 7, academic_year: '2026-2027', semester: '1st Semester', status: 'CLEARED' }] };
    return { rows: [] };
  }, { academic_year: '2026-2027', semester: '1st Semester' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.created, true);
  assert.equal(res.body.clearanceRecord.status, 'CLEARED');
  assert(queries.some(({ text }) => text.includes('pg_advisory_xact_lock')));
  assert(queries.some(({ text, params }) => text.includes('INSERT INTO audit_logs') && params?.[1] === 'CLEARANCE_APPROVE'));
});

test('student-level approval reuses an existing pending clearance record', async () => {
  const queries = [];
  const res = await runWithClient(async (sql) => {
    const text = String(sql); queries.push(text);
    if (text.includes('FROM students s JOIN users')) return { rows: [eligibleStudent] };
    if (text.includes('FROM student_clearance WHERE')) return { rows: [{ id: 44, student_id: 7, status: 'PENDING', academic_year: '2025-2026', semester: '2nd Semester' }] };
    if (text.includes('UPDATE student_clearance SET')) return { rows: [{ id: 44, student_id: 7, status: 'CLEARED' }] };
    return { rows: [] };
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.created, false);
  assert.equal(queries.some((text) => text.includes('INSERT INTO student_clearance')), false);
});

test('student-level approval rejects unresolved or incomplete requirements', async () => {
  const res = await runWithClient(async (sql) => String(sql).includes('FROM students s JOIN users')
    ? { rows: [{ ...eligibleStudent, service_complete: false }] } : { rows: [] });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /incomplete community service/i);
});

test('student-level approval requires a valid term when creating a record', async () => {
  const res = await runWithClient(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM students s JOIN users')) return { rows: [eligibleStudent] };
    if (text.includes('FROM student_clearance WHERE')) return { rows: [] };
    return { rows: [] };
  }, { academic_year: '2026-2029', semester: 'Other' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /valid academic year/i);
});

test('student-level approval returns not found for an unknown student', async () => {
  const res = await runWithClient(async () => ({ rows: [] }), {}, '999');
  assert.equal(res.statusCode, 404);
});
