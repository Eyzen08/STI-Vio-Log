const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pool = require('../src/config/database');
const { status, accountDirectory, platformMetadata } = require('../src/controllers/systemAdministrationController');

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

test('system metadata identifies configured providers without returning configuration values',()=>{
  const metadata=platformMetadata({RENDER_SERVICE_ID:'srv-private',DATABASE_URL:'postgresql://secret@pooler.supabase.com/postgres',BREVO_API_KEY:'private-key'});
  assert.deepEqual(metadata.api,{provider:'Render',technology:'Node.js / Express',icon:'render'});
  assert.equal(metadata.database.provider,'Supabase');assert.equal(metadata.email_delivery.provider,'Brevo');
  assert.equal(JSON.stringify(metadata).includes('private-key'),false);assert.equal(JSON.stringify(metadata).includes('pooler.supabase.com'),false);
});

test('account directory exposes safe action capabilities for self, locked, and final-admin targets',async(t)=>{
  const original=pool.query;
  pool.query=async()=>({rows:[
    {id:7,username:'signed-in',role:'DISCIPLINE_ADMIN',is_active:true,active_admin_count:2},
    {id:8,username:'student',role:'STUDENT',is_active:false,active_admin_count:2},
    {id:9,username:'admin-two',role:'DISCIPLINE_ADMIN',is_active:true,active_admin_count:1}
  ]});
  t.after(()=>{pool.query=original});
  let payload;
  await accountDirectory({query:{},user:{id:7}},{json(value){payload=value;return this},status(){return this}});
  assert.equal(payload.accounts[0].can_lock,false);assert.equal(payload.accounts[0].can_recover,false);
  assert.equal(payload.accounts[1].lock_restriction_code,'ACCOUNT_ALREADY_LOCKED');assert.equal(payload.accounts[1].can_recover,true);
  assert.equal(payload.accounts[2].lock_restriction_code,'LAST_ADMIN');
  assert.equal(JSON.stringify(payload).includes('active_admin_count'),false);
});
