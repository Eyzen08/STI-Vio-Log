const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const session = require('../src/services/browserSessionService');
const { csrf } = require('../src/controllers/sessionController');
const { requireCsrf } = require('../src/middleware/authMiddleware');

const response = () => ({ headers: [], append(name, value) { this.headers.push(value); }, json(body) { this.body = body; return this; } });

test('bootstrap preserves a valid existing session token without rotating its cookie or hash', async (t) => {
  const query = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const req = { headers: { cookie: 'sti_session=opaque; sti_csrf=existing' }, session: { id: 7, csrfHash: session.hash('existing', process.env.CSRF_SIGNING_KEY) } };
  const res = response();
  await csrf(req, res);
  assert.equal(res.body.csrf_token, 'existing');
  assert.deepEqual(res.headers, []);
  assert.equal(query.mock.callCount(), 0);
});

test('concurrent recovery agrees for one session and remains isolated from other sessions', async (t) => {
  const updates = [];
  t.mock.method(pool, 'query', async (sql, values) => { updates.push(values); await new Promise(resolve => setImmediate(resolve)); return { rows: [] }; });
  const recover = async (id, cookie = '') => {
    const res = response();
    await csrf({ headers: { cookie: `sti_session=opaque-${id}; ${cookie}` }, session: { id, csrfHash: 'old' } }, res);
    return res;
  };
  const results = await Promise.all([recover(7), recover(7, 'sti_csrf=forged'), recover(7, 'sti_csrf=%ZZ'), recover(8)]);
  const token = results[0].body.csrf_token;
  assert.ok(token);
  assert.equal(results[1].body.csrf_token, token);
  assert.equal(results[2].body.csrf_token, token);
  assert.notEqual(results[3].body.csrf_token, token);
  for (const res of results) assert.match(res.headers[0], /sti_csrf=.+; Path=\/; SameSite=Lax/);
  const hash = updates.find(values => values[0] === 7)[1];
  let accepted = false;
  requireCsrf({ method: 'POST', headers: { cookie: `sti_csrf=${token}` }, get: () => token, session: { csrfHash: hash } }, {}, () => { accepted = true; });
  assert.equal(accepted, true);
  assert.ok(updates.filter(values => values[0] === 7).every(values => values[1] === hash));
});

test('CSRF rejects absent, forged, mismatched and cross-session credentials', () => {
  for (const [cookie, header] of [['', 'valid'], ['valid', ''], ['forged', 'forged'], ['valid', 'different'], ['other-session', 'other-session'], ['%ZZ', '%ZZ']]) {
    let accepted = false;
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    requireCsrf({ method: 'POST', headers: { cookie: `sti_csrf=${cookie}` }, get: () => header, session: { csrfHash: session.hash('valid', process.env.CSRF_SIGNING_KEY) } }, res, () => { accepted = true; });
    assert.equal(accepted, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');
  }
});
