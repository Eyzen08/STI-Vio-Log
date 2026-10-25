const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'r'.repeat(48);
process.env.DATABASE_URL = 'postgresql://localhost/rate_limit_test';

const app = require('../src/server');
const pool = require('../src/config/database');
const sessions = require('../src/services/browserSessionService');
app.set('trust proxy', 1);

let origin;
let server;
const accounts = new Map();
const sessionCookie = (token, id, overrides = {}) => {
  accounts.set(sessions.hash(token), {
    id, username: `account-${id}`, role: 'DISCIPLINE_ADMIN', email_verified: true,
    session_version: 1, must_change_password: false, browser_session_id: id,
    csrf_hash: sessions.hash('valid-csrf', process.env.CSRF_SIGNING_KEY),
    absolute_expires_at: new Date(Date.now() + 900000), ...overrides
  });
  return `sti_session=${token}; sti_csrf=valid-csrf`;
};
const request = async (path, ip, { cookie, method = 'GET', ...headers } = {}) => {
  const response = await fetch(origin + path, {
    method, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}), ...headers }
  });
  const body = method === 'HEAD' ? null : await response.json();
  return { status: response.status, headers: response.headers, body };
};
const assertLimited = (response) => {
  assert.equal(response.status, 429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(response.headers.get('retry-after')) > 0);
};

test.before(async () => {
  pool.query = async (sql, values) => {
    if (String(sql).includes('FROM browser_sessions bs')) {
      if (values[0] === sessions.hash('database-unavailable')) throw new Error('Database unavailable');
      const account = accounts.get(values[0]);
      return { rows: account ? [account] : [] };
    }
    if (String(sql).startsWith('UPDATE browser_sessions') || String(sql).includes('INSERT INTO administrative_security_events')) return { rows: [] };
    if (String(sql).includes('SELECT acknowledged_at')) return { rows: [{ acknowledged_at: new Date() }] };
    throw new Error(`Unexpected fixture query: ${sql}`);
  };
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

test('verified accounts get 600 shared reads across sessions, tabs, HEADs, paths and IPs', async () => {
  const cookies = [sessionCookie('read-tab-one', 101), sessionCookie('read-tab-two', 101)];
  for (let index = 0; index < 600; index++) {
    const response = await request(index % 2 ? '/api/auth/legal' : '/api/auth/session', `192.0.2.${index % 2 + 1}`, {
      cookie: cookies[index % 2], method: index % 3 ? 'GET' : 'HEAD', 'x-user-id': String(index)
    });
    assert.equal(response.status, 200, `read ${index + 1}`);
  }
  assertLimited(await request('/api/auth/session', '192.0.2.3', { cookie: cookies[0] }));
  const other = await request('/api/auth/session', '192.0.2.1', { cookie: sessionCookie('school-peer', 102) });
  assert.equal(other.status, 200);
  assert.equal(other.body.user.id, 102);
  assert.equal(other.headers.get('ratelimit-remaining'), '599');
  assert.equal((await request('/api/auth/session', '192.0.2.1')).status, 401);
});

test('forged, revoked and missing sessions share the 200 failed-read IP guard without account credit', async () => {
  for (let index = 0; index < 200; index++) {
    const response = await request('/api/auth/session?user_id=201', '192.0.2.20', {
      cookie: index % 3 ? `sti_session=${index % 2 ? 'forged' : 'revoked'}` : undefined,
      'x-user-id': '201'
    });
    assert.equal(response.status, 401);
  }
  assertLimited(await request('/api/auth/session', '192.0.2.20'));
  const cookie = sessionCookie('unaffected-account', 201);
  assertLimited(await request('/api/auth/session', '192.0.2.20', { cookie }));
  const allowed = await request('/api/auth/session', '192.0.2.21', { cookie });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('ratelimit-remaining'), '599');
});

test('transient session validation failures consume neither failure nor verified-account budgets', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (let index = 0; index < 205; index++) {
    assert.equal((await request('/api/auth/session', '192.0.2.30', { cookie: 'sti_session=database-unavailable' })).status, 500);
  }
  const response = await request('/api/auth/session', '192.0.2.30', { cookie: sessionCookie('database-recovered', 301) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('ratelimit-remaining'), '599');
});

test('public reads and writes retain one shared 200/IP budget while CSRF remains enforced', async () => {
  const ip = '192.0.2.40';
  const cookie = sessionCookie('writes', 401);
  for (let index = 0; index < 100; index++) {
    assert.equal((await request('/', ip)).status, 200);
    const response = await request('/api/auth/logout', ip, { cookie, method: 'POST' });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'CSRF_INVALID');
  }
  assertLimited(await request('/', ip));
  assertLimited(await request('/api/auth/logout', ip, { cookie, method: 'POST' }));
  assert.equal((await request('/api/auth/session', ip, { cookie })).status, 200);
});

test('failed authorization remains guarded and does not grant another account access', async () => {
  const cookie = sessionCookie('student-forbidden', 501, { role: 'STUDENT' });
  for (let index = 0; index < 200; index++) {
    assert.equal((await request('/api/department-heads', '192.0.2.50', { cookie })).status, 403);
  }
  assertLimited(await request('/api/auth/session', '192.0.2.50', { cookie }));
  const other = await request('/api/auth/session', '192.0.2.51', { cookie });
  assert.equal(other.status, 200);
  assert.equal(other.body.user.id, 501);
});

test('sensitive authentication routes retain their shared ten-attempt limit', async () => {
  for (let index = 0; index < 10; index++) {
    const response = await request(index % 2 ? '/api/auth/mfa/setup/start' : '/api/login', '192.0.2.60', { method: 'POST' });
    assert.ok([400, 401].includes(response.status));
  }
  assertLimited(await request('/api/auth/mfa/verify', '192.0.2.60', { method: 'POST' }));
});

test('Express case-insensitive and trailing-slash protected routes still receive the read budget', async () => {
  const cookie = sessionCookie('case-insensitive', 701);
  const response = await request('/API/AUTH/SESSION/', '192.0.2.70', { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('ratelimit-limit'), '600');
});
