const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleDepartmentRegistrationService } = require('../src/services/googleDepartmentRegistrationService');

const pending = {
  id: 9, google_subject: 'private-subject', google_email: 'officer@example.test',
  officer_first_name: 'Alex', officer_last_name: 'Reyes', employee_number: 'EMP-9',
  requested_department_type: 'LIBRARY', requested_department_name: 'Library Department',
  status: 'PENDING', created_at: new Date('2026-01-01T00:00:00Z')
};

const fakePool = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, release() {} };
  return { calls, pool: { async connect() { return client; }, async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); } } };
};

test('department review verifies an active Admin inside the transaction', async () => {
  const db = fakePool(() => ({ rows: [] }));
  const service = createGoogleDepartmentRegistrationService({ pool: db.pool });
  await assert.rejects(
    service.review({ registrationId: 9, reviewerId: 4, decision: 'REJECTED', reason: 'Not employed' }),
    (error) => error.statusCode === 403 && error.code === 'REVIEWER_FORBIDDEN'
  );
  assert.ok(db.calls.some((call) => call.sql.includes("role='ADMIN'") && call.sql.includes('FOR UPDATE')));
  assert.ok(db.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('department approval serializes subject and employee ownership and rechecks cross-role claims', async () => {
  const db = fakePool((sql) => {
    if (sql.includes("role='ADMIN'")) return { rows: [{ id: 1 }] };
    if (sql.includes('FROM google_department_registrations WHERE id')) return { rows: [pending] };
    if (sql.includes('FROM departments WHERE id=')) return { rows: [{ id: 3 }] };
    if (sql.includes('SELECT 1 FROM users')) return { rows: [{ exists: 1 }] };
    return { rows: [] };
  });
  const service = createGoogleDepartmentRegistrationService({ pool: db.pool });
  await assert.rejects(
    service.review({ registrationId: 9, reviewerId: 1, decision: 'APPROVED', reason: 'Verified', departmentId: 3 }),
    (error) => error.code === 'REGISTRATION_CONFLICT'
  );
  const locks = db.calls.filter((call) => call.sql.includes('pg_advisory_xact_lock')).map((call) => call.params[0]);
  assert.deepEqual(locks, ['google-identity:private-subject', 'department-employee:EMP-9']);
  assert.ok(db.calls.some((call) => call.sql.includes('google_student_registrations')));
});

test('department review queue never exposes the stable Google subject', async () => {
  const db = fakePool((sql) => sql.includes('FROM departments') ? { rows: [] } : { rows: [pending] });
  const result = await createGoogleDepartmentRegistrationService({ pool: db.pool }).list();
  assert.equal(result.registrations[0].google_email, pending.google_email);
  assert.equal('google_subject' in result.registrations[0], false);
});
