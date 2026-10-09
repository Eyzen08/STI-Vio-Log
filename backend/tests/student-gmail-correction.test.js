const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createStudentCredentialsCorrectionController } = require('../src/controllers/studentController');

const password = 'Old-test-password!Aa1';
const row = { id: 55, user_id: 8, username: '02000123456', email: 'wrong@gmail.com', password_hash: bcrypt.hashSync(password, 4), is_active: true, must_change_password: true, onboarding_required: true, onboarding_completed_at: null };
const response = () => ({ statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const setup = ({ account = row, duplicate = false, linked = false, failAudit = false } = {}) => {
  const calls = [];
  const db = { connect: async () => ({ release() {}, query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM students s JOIN users')) return { rows: account ? [account] : [] };
    if (sql.startsWith('SELECT 1 FROM google_identity_links')) return { rows: linked ? [{}] : [] };
    if (sql.startsWith('SELECT 1 FROM students')) return { rows: duplicate ? [{}] : [] };
    if (sql.startsWith('UPDATE students')) return { rows: [{ id: 55, email: params[1] }] };
    if (sql.includes('INSERT INTO audit_logs') && failAudit) throw new Error('audit unavailable');
    return { rows: [] };
  } }) };
  return { calls, handler: createStudentCredentialsCorrectionController({ db }) };
};
const request = (body = {}) => ({ user: { id: 1, role: 'DISCIPLINE_ADMIN' }, params: { id: '55' }, body: { email: ' Correct@GMAIL.COM ', reason: 'Corrected a typing error', temporary_password: password, ...body } });

test('Gmail correction replaces the password, revokes authorizations, and returns no cached secrets', async () => {
  const fixture = setup(), res = response();
  await fixture.handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.student.email, 'correct@gmail.com');
  assert.notEqual(res.body.temporary_password, password);
  const update = fixture.calls.find(call => call.sql.startsWith('UPDATE users'));
  assert.match(update.sql, /INTERVAL '24 hours'/);
  assert.match(update.sql, /session_version=session_version\+1/);
  assert(await bcrypt.compare(res.body.temporary_password, update.params[1]));
  assert.equal(await bcrypt.compare(password, update.params[1]), false);
  for (const table of ['browser_sessions', 'auth_otps', 'password_reset_authorizations']) assert(fixture.calls.some(call => call.sql.startsWith(`UPDATE ${table}`)));
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.password_hash, undefined);
  assert(!JSON.stringify(fixture.calls.find(call => call.sql.includes('INSERT INTO audit_logs'))).includes(res.body.temporary_password));
  assert.equal(fixture.calls.at(-1).sql, 'COMMIT');
});

test('invalid corrections never reach the database', async () => {
  for (const body of [{ email: 'student@yahoo.com' }, { email: '@gmail.com' }, { email: 'a@@gmail.com' }, { email: 'a'.repeat(246) + '@gmail.com' }, { reason: '' }, { reason: 12 }, { role: 'STUDENT' }, { temporary_password: password + 'x'.repeat(80) }]) {
    const fixture = setup(), res = response();
    await fixture.handler(request(body), res);
    assert.equal(res.statusCode, 400);
    assert.equal(fixture.calls.length, 0);
  }
});

test('stale credentials and accounts beyond activation cannot be corrected through the credential dialog', async () => {
  for (const account of [{ ...row, is_active: false }, { ...row, must_change_password: false }, { ...row, onboarding_required: false }, { ...row, onboarding_completed_at: new Date() }, { ...row, password_hash: null }, null]) {
    const fixture = setup({ account }), res = response();
    await fixture.handler(request(), res);
    assert([404, 409].includes(res.statusCode));
    assert.equal(fixture.calls.some(call => call.sql.startsWith('UPDATE ')), false);
  }
  const fixture = setup(), res = response();
  await fixture.handler(request({ temporary_password: 'Replaced!Password123' }), res);
  assert.equal(res.body.error.code, 'CREDENTIALS_REPLACED');
  assert.equal(fixture.calls.at(-1).sql, 'ROLLBACK');
});

test('duplicate or linked Gmail corrections roll back, while unchanged Gmail does not rotate credentials', async () => {
  for (const [settings, body, code] of [[{ duplicate: true }, {}, 'STUDENT_EMAIL_CONFLICT'], [{ linked: true }, {}, 'GOOGLE_RECOVERY_REQUIRED'], [{}, { email: row.email }, 'EMAIL_UNCHANGED']]) {
    const fixture = setup(settings), res = response();
    await fixture.handler(request(body), res);
    assert.equal(res.body.error.code, code);
    assert.equal(fixture.calls.some(call => call.sql.startsWith('UPDATE ')), false);
    if (settings.duplicate) assert(fixture.calls.some(call => call.sql.includes('INSERT INTO administrative_security_events')));
  }
});

test('a transaction failure exposes neither credentials nor internal errors', async () => {
  const fixture = setup({ failAudit: true }), res = response();
  await fixture.handler(request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.temporary_password, undefined);
  assert(!JSON.stringify(res.body).includes('audit unavailable'));
  assert.equal(fixture.calls.at(-1).sql, 'ROLLBACK');
});
