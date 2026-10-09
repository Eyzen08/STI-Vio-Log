const test = require('node:test');
const assert = require('node:assert/strict');
const {createGoogleIdentityService,LOGIN_FAILURE}=require('../src/services/googleIdentityService');
const identity={subject:'google-sub-44',email:'student@gmail.com',emailVerified:true};
const fakeDatabase = (handler) => {
  const calls = [];
  const client = { async query(sql, params = []) { calls.push({ scope: 'client', sql: String(sql), params }); return handler(String(sql), params); }, release() { calls.push({ scope: 'client', sql: 'RELEASE', params: [] }); } };
  return { calls, pool: { async connect() { return client; }, async query(sql, params = []) { calls.push({ scope: 'pool', sql: String(sql), params }); return { rows: [] }; } } };
};

test('linked Google login updates metadata and audit atomically', async () => {
  const db = fakeDatabase((sql) => sql.includes('FROM google_identity_links gil') ? { rows: [{ id: 44, username: 'student44', role: 'STUDENT', first_name: 'Maria', last_name: 'Santos', link_id: 91 }] } : { rows: [] });
  const service = createGoogleIdentityService({ pool: db.pool, verifyIdentity: async () => identity, issueToken: () => 'session-token' });
  assert.deepEqual(await service.loginStudent({ credential: 'token' }), { token: 'session-token', user: { avatar:{source:'INITIALS',preset_id:null,photo_url:null}, id: 44, username: 'student44', role: 'STUDENT', first_name: 'Maria', last_name: 'Santos', full_name: 'Maria Santos', password_change_required:false, onboarding_required:false, onboarding_step:'COMPLETE' } });
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

test('Google login throttles by verified account identifier and IP', async () => {
  const db = fakeDatabase((sql) => sql.includes('FROM google_identity_links gil') ? { rows: [] } : { rows: [] });
  const calls=[];
  const authThrottle={async assertAllowed(input){calls.push(['assert',input])},async failure(input){calls.push(['failure',input])},async success(input){calls.push(['success',input])}};
  const service = createGoogleIdentityService({ pool:db.pool, verifyIdentity:async()=>identity, issueToken:()=>null, authThrottle });
  await assert.rejects(service.loginStudent({credential:'token',ipAddress:'203.0.113.8'}),/linked to an active student/i);
  assert.deepEqual(calls.map(([kind,input])=>[kind,input.identifier,input.ip]),[['assert',identity.subject,'203.0.113.8'],['failure',identity.subject,'203.0.113.8']]);
});
