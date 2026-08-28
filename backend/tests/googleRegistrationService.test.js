const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleRegistrationService } = require('../src/services/googleRegistrationService');

const pending = { id: 7, google_subject: 'private-google-subject', google_email: 'new@example.test', student_number: '02000654321', first_name: 'New', last_name: 'Student', phone_number: '09171234567', program: 'BSIT', section: 'A103', year_level: 3, guardian_name: 'Maria Student', guardian_relationship: 'Mother', guardian_phone_number: '09181234567', status: 'PENDING', created_at: new Date('2026-01-01T00:00:00Z') };

const fakePool = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); }, release() {} };
  return { calls, pool: { async connect() { return client; }, async query(sql, params = []) { calls.push({ sql: String(sql), params }); return handler(String(sql), params); } } };
};

test('review queue omits the stable Google subject', async () => {
  const db = fakePool(() => ({ rows: [pending] }));
  const service = createGoogleRegistrationService({ pool: db.pool });
  const [result] = await service.list({ status: 'pending' });
  assert.equal(result.student_number, pending.student_number);
  assert.equal('google_subject' in result, false);
});

test('approval atomically creates an active student, opaque QR, link, and audit', async () => {
  let randomCall = 0;
  const db = fakePool((sql) => {
    if (sql.includes('FROM google_student_registrations WHERE id')) return { rows: [pending] };
    if (sql.includes('SELECT 1 FROM users')) return { rows: [] };
    if (sql.includes('INSERT INTO users')) return { rows: [{ id: 50, username: pending.student_number }] };
    if (sql.includes('INSERT INTO students')) return { rows: [{ id: 55 }] };
    if (sql.includes('INSERT INTO google_identity_links')) return { rows: [{ id: 60 }] };
    if (sql.includes("SET status = 'APPROVED'")) return { rows: [{ ...pending, status: 'APPROVED', review_reason: 'Enrollment verified', reviewed_at: new Date() }] };
    return { rows: [] };
  });
  const service = createGoogleRegistrationService({ pool: db.pool, hashPassword: async () => 'secure-hash', randomBytes: () => Buffer.from(`opaque-${++randomCall}`) });
  const result = await service.review({ registrationId: 7, reviewerId: 2, decision: 'APPROVED', reason: 'Enrollment verified' });
  assert.equal(result.status, 'APPROVED');
  assert.ok(db.calls.some((call) => call.sql.includes("'STUDENT'")));
  assert.ok(db.calls.some((call) => call.sql.includes('INSERT INTO students')));
  assert.ok(db.calls.some((call) => call.sql.includes('INSERT INTO student_guardians')));
  assert.ok(db.calls.some((call) => call.sql.includes('GOOGLE_REGISTRATION_APPROVED')));
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
  const auditCall = db.calls.find((call) => call.sql.includes('GOOGLE_REGISTRATION_APPROVED'));
  assert.equal(auditCall.params.includes(pending.google_subject), false);
});

test('rejection preserves the request and records the reviewer reason', async () => {
  const db = fakePool((sql) => {
    if (sql.includes('FROM google_student_registrations WHERE id')) return { rows: [pending] };
    if (sql.includes("SET status = 'REJECTED'")) return { rows: [{ ...pending, status: 'REJECTED', review_reason: 'Enrollment not found', reviewed_at: new Date() }] };
    return { rows: [] };
  });
  const service = createGoogleRegistrationService({ pool: db.pool });
  const result = await service.review({ registrationId: 7, reviewerId: 2, decision: 'REJECTED', reason: 'Enrollment not found' });
  assert.equal(result.status, 'REJECTED');
  assert.ok(db.calls.some((call) => call.sql.includes('GOOGLE_REGISTRATION_REJECTED')));
  assert.equal(db.calls.some((call) => call.sql.includes('DELETE')), false);
});

test('review requires a reason and a pending registration', async () => {
  const db = fakePool(() => ({ rows: [] }));
  const service = createGoogleRegistrationService({ pool: db.pool });
  await assert.rejects(service.review({ registrationId: 7, reviewerId: 2, decision: 'APPROVED', reason: '' }), (error) => error.code === 'VALIDATION_ERROR');
  await assert.rejects(service.review({ registrationId: 7, reviewerId: 2, decision: 'APPROVED', reason: 'Checked' }), (error) => error.code === 'REGISTRATION_NOT_PENDING');
});
