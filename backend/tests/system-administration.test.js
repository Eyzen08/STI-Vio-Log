const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pool = require('../src/config/database');
const { status } = require('../src/controllers/systemAdministrationController');

test('system status returns sanitized connectivity and never returns secret values', async (t) => {
    const original = pool.query;
    pool.query = async () => ({ rows: [{ healthy: 1 }] });
    t.after(() => { pool.query = original; });
    const previous = { JWT_SECRET: process.env.JWT_SECRET, DATABASE_URL: process.env.DATABASE_URL };
    process.env.JWT_SECRET = 'never-return-this-jwt-secret';
    process.env.DATABASE_URL = 'postgresql://secret:password@private/database';
    t.after(() => Object.assign(process.env, previous));
    let payload;
    await status({}, { json(value) { payload = value; return this; }, status() { return this; } });
    assert.equal(payload.system.database, 'CONNECTED');
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(process.env.JWT_SECRET), false);
    assert.equal(serialized.includes(process.env.DATABASE_URL), false);
    assert.equal(serialized.includes('password'), false);
});

test('system routes require technical permissions', () => {
    const source = fs.readFileSync(require.resolve('../src/routes/systemAdministrationRoutes'), 'utf8');
    assert.match(source, /SYSTEM_HEALTH_VIEW/);
    assert.match(source, /SYSTEM_VERSION_VIEW/);
});

test('system routes expose security events and authentication activity behind exact permissions', () => {
  const source=fs.readFileSync(require.resolve('../src/routes/systemAdministrationRoutes'),'utf8');
  assert.match(source,/security-events[^\n]+SECURITY_EVENTS_VIEW/);
  assert.match(source,/authentication-activity[^\n]+AUTH_ACTIVITY_VIEW/);
});
