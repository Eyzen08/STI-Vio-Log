const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleIdentityService, LINK_FAILURE, LOGIN_FAILURE, normalizeName, namesMatch } = require('../src/services/googleIdentityService');

const account = { id: 44, username: 'student44', role: 'STUDENT', first_name: 'Maria Ana', last_name: 'De Leon' };
const identity = Object.freeze({ subject: 'google-sub-44', email: 'student@example.test', emailVerified: true });
const profile = { phoneNumber: '09171234567', program: 'BSIT', section: 'A103', yearLevel: 3, guardianName: 'Maria Student', guardianRelationship: 'Mother', guardianPhoneNumber: '09181234567' };

const fakeDatabase = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ scope: 'client', sql: String(sql), params }); return handler(String(sql), params); }, release() { calls.push({ scope: 'client', sql: 'RELEASE', params: [] }); } };
  return { calls, pool: { async connect() { return client; }, async query(sql, params = []) { calls.push({ scope: 'pool', sql: String(sql), params }); return { rows: [] }; } } };
};

test('Google identity linking normalizes names, commits link and audit, then issues a session', async () => {
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM students s')) return { rows: [account] };
    if (sql.includes('INSERT INTO google_identity_links')) return { rows: [{ id: 91 }] };
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: (user) => `token-${user.id}` });
  const result = await service.linkStudent({ credential: 'verified-token', studentNumber: '02000123456', firstName: '  MARIA ANA ', lastName: 'de leon', ...profile, ipAddress: '127.0.0.1' });
  assert.deepEqual(result, { token: 'token-44', user: { id: 44, username: 'student44', role: 'STUDENT' } });
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
  assert.ok(db.calls.some((call) => call.sql.includes("'GOOGLE_LINK'")));
  assert.equal(db.calls.some((call) => call.sql.includes('verified-token') || call.params.includes('verified-token')), false);
});

test('unknown students create a pending registration without a session or credential leak', async () => {
  const db = fakeDatabase((sql) => sql.includes('INSERT INTO google_student_registrations') ? { rows: [{ id: 73 }] } : { rows: [] });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  const result = await service.linkStudent({ credential: 'verified-token', studentNumber: '02000123456', firstName: 'New', lastName: 'Student', ...profile });
  assert.deepEqual(result, { pending: true, message: 'Student registration submitted for Discipline Office review', registration: { id: 73, status: 'PENDING' } });
  assert.equal('token' in result, false);
  assert.ok(db.calls.some((call) => call.sql.includes('GOOGLE_REGISTRATION_SUBMITTED')));
  assert.equal(db.calls.some((call) => call.sql.includes('verified-token') || call.params.includes('verified-token')), false);
});

test('name mismatch for an existing student remains a generic link failure', async () => {
  const db = fakeDatabase((sql) => sql.includes('FROM students s') ? { rows: [{ ...account, last_name: 'Different' }] } : { rows: [] });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'Maria Ana', lastName: 'De Leon', ...profile }), (error) => error.statusCode === 409 && error.code === 'STUDENT_LINK_UNAVAILABLE' && error.message === LINK_FAILURE);
  assert.ok(db.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('a different Google identity cannot reuse another pending student number', async () => {
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM google_student_registrations')) return { rows: [{ id: 73, google_subject: 'other-subject', student_number: '02000123456', first_name: 'New', last_name: 'Student' }] };
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'New', lastName: 'Student', ...profile }), (error) => error.code === 'STUDENT_LINK_UNAVAILABLE');
});

test('submission rechecks ownership after waiting on the pending queue', async () => {
  let ownershipChecks = 0;
  const db = fakeDatabase((sql) => {
    if (sql.includes('SELECT 1 FROM students')) {
      ownershipChecks += 1;
      return { rows: ownershipChecks === 1 ? [] : [{ exists: 1 }] };
    }
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'New', lastName: 'Student', ...profile }), (error) => error.code === 'STUDENT_LINK_UNAVAILABLE');
  assert.equal(db.calls.some((call) => call.sql.includes('INSERT INTO google_student_registrations')), false);
});

test('duplicate Google links roll back and create a token-free rejection audit', async () => {
  const duplicate = Object.assign(new Error('duplicate secret-subject'), { code: '23505' });
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM students s')) return { rows: [account] };
    if (sql.includes('INSERT INTO google_identity_links')) throw duplicate;
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'Maria Ana', lastName: 'De Leon', ...profile }), (error) => error.message === LINK_FAILURE);
  assert.ok(db.calls.some((call) => call.scope === 'client' && call.sql.includes('GOOGLE_LINK_REJECTED')));
  assert.equal(db.calls.some((call) => call.sql.includes(identity.subject) || (call.params.includes(identity.subject) && call.sql.includes('GOOGLE_LINK_REJECTED'))), false);
});

test('linked Google login updates metadata and audit atomically', async () => {
  const db = fakeDatabase((sql) => sql.includes('FROM google_identity_links gil') ? { rows: [{ id: 44, username: 'student44', role: 'STUDENT', link_id: 91 }] } : { rows: [] });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'session-token' });
  assert.deepEqual(await service.loginStudent({ credential: 'token' }), { token: 'session-token', user: { id: 44, username: 'student44', role: 'STUDENT' } });
  assert.ok(db.calls.some((call) => call.sql.includes('last_login_at = CURRENT_TIMESTAMP')));
  assert.ok(db.calls.some((call) => call.sql.includes("'GOOGLE_LOGIN'")));
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
});

test('unlinked Google login is generic and rolls back', async () => {
  const db = fakeDatabase((sql) => sql.includes('FROM google_identity_links gil') ? { rows: [] } : { rows: [] });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.loginStudent({ credential: 'token' }), (error) => error.statusCode === 401 && error.code === 'GOOGLE_LOGIN_FAILED' && error.message === LOGIN_FAILURE);
  assert.ok(db.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('name normalization is Unicode-aware and collapses whitespace', () => {
  assert.equal(normalizeName('  MARIA\t Ana '), 'maria ana');
  assert.equal(normalizeName(null), '');
});

test('school-name matching tolerates a different split of multi-word names', () => {
  assert.equal(namesMatch({ first_name: 'Mang Jose', last_name: 'dela Cruz' }, 'Mang Jose dela', 'Cruz'), true);
  assert.equal(namesMatch({ first_name: 'Mang Jose', last_name: 'dela Cruz' }, 'Jose', 'dela Cruz'), false);
});

test('a revoked identity can create a new active link after the school record matches', async () => {
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM students s')) return { rows: [account] };
    if (sql.includes('INSERT INTO google_identity_links')) return { rows: [{ id: 92 }] };
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'relinked-session' });
  const result = await service.linkStudent({ credential: 'new-token', studentNumber: '02000123456', firstName: 'Maria', lastName: 'Ana De Leon', ...profile });
  assert.equal(result.token, 'relinked-session');
  assert.ok(db.calls.some((call) => call.sql.includes('INSERT INTO google_identity_links')));
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
});
