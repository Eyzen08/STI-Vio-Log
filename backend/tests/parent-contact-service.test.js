const test = require('node:test');
const assert = require('node:assert/strict');
const { createParentContactService } = require('../src/services/parentContactService');

const actor = { id: 3, role: 'DEPARTMENT_HEAD', department_id: 9 };
const fakePool = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, release() {} };
  return { calls, pool: { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, async connect() { return client; } } };
};

test('department contact access is scoped by authenticated department attendance', async () => {
  const db = fakePool((sql) => {
    if (sql.includes('FROM students s')) return { rows: [{ id: 40, student_number: '02000123456', first_name: 'Ana', last_name: 'Reyes' }] };
    if (sql.includes('FROM student_guardians')) return { rows: [{ id: 7, guardian_name: 'Maria Reyes', relationship: 'Mother', phone_number: '09181234567', is_primary: true }] };
    return { rows: [] };
  });
  const result = await createParentContactService({ pool: db.pool }).read({ actor, studentId: 40 });
  assert.equal(result.guardians[0].phone_number, '09181234567');
  const scope = db.calls.find((call) => call.sql.includes('community_service_sessions'));
  assert.deepEqual(scope.params, [40, true, 9]);
});

test('invisible department students return the same non-sensitive missing response', async () => {
  const db = fakePool(() => ({ rows: [] }));
  await assert.rejects(createParentContactService({ pool: db.pool }).read({ actor, studentId: 41 }), (error) => error.statusCode === 404 && error.code === 'STUDENT_NOT_VISIBLE');
});

test('contact attempts derive actor and department and append an audit event', async () => {
  const db = fakePool((sql) => {
    if (sql.includes('FROM students s')) return { rows: [{ id: 40, student_number: '02000123456' }] };
    if (sql.includes('SELECT id FROM student_guardians')) return { rows: [{ id: 7 }] };
    if (sql.includes('INSERT INTO parent_contact_logs')) return { rows: [{ id: 12, guardian_id: 7, contact_method: 'CALL', outcome: 'REACHED', notes: 'Confirmed', created_at: new Date() }] };
    return { rows: [] };
  });
  const result = await createParentContactService({ pool: db.pool }).record({ actor, studentId: 40, guardianId: 7, method: 'call', outcome: 'reached', notes: 'Confirmed' });
  assert.equal(result.id, 12);
  const insert = db.calls.find((call) => call.sql.includes('INSERT INTO parent_contact_logs'));
  assert.deepEqual(insert.params.slice(0, 6), [40, 7, 3, 9, 'CALL', 'REACHED']);
  assert.ok(db.calls.some((call) => call.sql.includes('PARENT_CONTACT_RECORDED')));
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
});

