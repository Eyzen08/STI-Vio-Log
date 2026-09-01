const test = require('node:test');
const assert = require('node:assert/strict');
const { createParentContactService } = require('../src/services/parentContactService');

const actor = { id: 3, role: 'DISCIPLINE_OFFICE' };
const fakePool = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, release() {} };
  return { calls, pool: { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, async connect() { return client; } } };
};

test('Discipline Office can read the student guardian contact record', async () => {
  const db = fakePool((sql) => {
    if (sql.includes('FROM students s')) return { rows: [{ id: 40, student_number: '02000123456', first_name: 'Ana', last_name: 'Reyes' }] };
    if (sql.includes('FROM student_guardians')) return { rows: [{ id: 7, guardian_name: 'Maria Reyes', relationship: 'Mother', phone_number: '09181234567', is_primary: true }] };
    return { rows: [] };
  });
  const result = await createParentContactService({ pool: db.pool }).read({ actor, studentId: 40 });
  assert.equal(result.guardians[0].phone_number, '09181234567');
  const scope = db.calls.find((call) => call.sql.includes('FROM students s'));
  assert.deepEqual(scope.params, [40]);
});

test('Department Accounts cannot read guardian data even when a student is assigned to them', async () => {
  const db = fakePool(() => ({ rows: [{ id: 41 }] }));
  await assert.rejects(createParentContactService({ pool: db.pool }).read({ actor: { id: 8, role: 'DEPARTMENT_HEAD', department_id: 9 }, studentId: 41 }), (error) => error.statusCode === 403 && error.code === 'PARENT_CONTACT_FORBIDDEN');
  assert.equal(db.calls.length, 0);
});

test('Department Accounts cannot append guardian contact attempts', async () => {
  const db = fakePool(() => ({ rows: [{ id: 41 }] }));
  await assert.rejects(createParentContactService({ pool: db.pool }).record({ actor: { id: 8, role: 'DEPARTMENT_HEAD', department_id: 9 }, studentId: 41, guardianId: 7, method: 'CALL', outcome: 'REACHED' }), (error) => error.statusCode === 403 && error.code === 'PARENT_CONTACT_FORBIDDEN');
  assert.equal(db.calls.some((call) => call.sql.includes('INSERT INTO parent_contact_logs')), false);
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
  assert.deepEqual(insert.params.slice(0, 6), [40, 7, 3, null, 'CALL', 'REACHED']);
  assert.ok(db.calls.some((call) => call.sql.includes('PARENT_CONTACT_RECORDED')));
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
});
