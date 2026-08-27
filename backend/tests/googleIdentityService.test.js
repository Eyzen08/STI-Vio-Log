const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleIdentityService, LINK_FAILURE, LOGIN_FAILURE, normalizeName } = require('../src/services/googleIdentityService');

const account = { id: 44, username: 'student44', role: 'STUDENT', first_name: 'María  Ana', last_name: 'De León' };
const identity = Object.freeze({ subject: 'google-sub-44', email: 'student@example.test' });

const fakeDatabase = (handler) => {
  const calls = [];
  const client = {
    async query(sql, params = []) { calls.push({ scope: 'client', sql: String(sql), params }); return handler(String(sql), params); },
    release() { calls.push({ scope: 'client', sql: 'RELEASE', params: [] }); }
  };
  return {
    calls,
    pool: {
      async connect() { return client; },
      async query(sql, params = []) { calls.push({ scope: 'pool', sql: String(sql), params }); return { rows: [] }; }
    }
  };
};

test('Google identity linking normalizes names, commits link and audit, then issues a session', async () => {
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM students s')) return { rows: [account] };
    if (sql.includes('INSERT INTO google_identity_links')) return { rows: [{ id: 91 }] };
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: (user) => `token-${user.id}` });
  const result = await service.linkStudent({ credential: 'verified-token', studentNumber: '02000123456', firstName: '  MARÍA ANA ', lastName: 'de león', ipAddress: '127.0.0.1' });
  assert.deepEqual(result, { token: 'token-44', user: { id: 44, username: 'student44', role: 'STUDENT' } });
  assert.ok(db.calls.some((call) => call.sql === 'COMMIT'));
  assert.ok(db.calls.some((call) => call.sql.includes("'GOOGLE_LINK'")));
  assert.equal(db.calls.some((call) => call.sql.includes('verified-token') || call.params.includes('verified-token')), false);
});

test('Google identity linking gives the same public failure for unknown and mismatched students', async () => {
  for (const rows of [[], [{ ...account, last_name: 'Different' }]]) {
    const db = fakeDatabase((sql) => sql.includes('FROM students s') ? { rows } : { rows: [] });
    const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
    await assert.rejects(
      service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'María Ana', lastName: 'De León' }),
      (error) => error.statusCode === 409 && error.code === 'STUDENT_LINK_UNAVAILABLE' && error.message === LINK_FAILURE
    );
    assert.ok(db.calls.some((call) => call.sql === 'ROLLBACK'));
  }
});

test('duplicate Google links roll back and create a token-free rejection audit', async () => {
  const duplicate = Object.assign(new Error('duplicate secret-subject'), { code: '23505' });
  const db = fakeDatabase((sql) => {
    if (sql.includes('FROM students s')) return { rows: [account] };
    if (sql.includes('INSERT INTO google_identity_links')) throw duplicate;
    return { rows: [] };
  });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'unused' });
  await assert.rejects(service.linkStudent({ credential: 'token', studentNumber: '02000123456', firstName: 'María Ana', lastName: 'De León' }), (error) => error.message === LINK_FAILURE);
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
  assert.equal(normalizeName('  MARÍA\t Ana '), 'maría ana');
  assert.equal(normalizeName(null), '');
});
