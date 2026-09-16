const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const sessions=require('../src/services/browserSessionService');

const { authenticateToken, authorizeRoles } = require('../src/middleware/authMiddleware');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('authenticateToken rejects a missing session cookie', () => {
  const req = { headers: {},method:'GET' };
  const res = createRes();
  let called = false;

  authenticateToken(req, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
  assert.equal(res.body.success, false);
});

test('authenticateToken accepts an opaque cookie and derives current database identity', async () => {
  const token = 'opaque-browser-session';
  const req = { headers: { cookie: `sti_session=${token}` },method:'GET' };
  const res = createRes();
  let called = false;
  const originalQuery = pool.query;
  pool.query = async (sql,params) => String(sql).startsWith('UPDATE browser_sessions')?{rows:[]}:{ rows: [{ id: 1, username: 'admin', role: 'DISCIPLINE_ADMIN', session_version: 1, must_change_password: false, department_id: null,browser_session_id:8,csrf_hash:sessions.hash('csrf',process.env.CSRF_SIGNING_KEY),absolute_expires_at:new Date(Date.now()+60000) }] };

  await authenticateToken(req, res, () => {
    called = true;
  });

  pool.query = originalQuery;

  assert.equal(called, true);
  assert.equal(req.user.role, 'DISCIPLINE_ADMIN');
  assert.equal(res.statusCode, 200);
});

test('authorizeRoles denies users without required role', () => {
  const req = { user: { role: 'STUDENT' } };
  const res = createRes();
  let called = false;

  authorizeRoles('ADMIN')(req, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test('authenticateToken rejects an expired or revoked opaque session', async () => {
  const req={headers:{cookie:'sti_session=revoked'},method:'GET'},res=createRes();let called=false;const originalQuery=pool.query;
  pool.query=async()=>({rows:[]});
  await authenticateToken(req,res,()=>{called=true});pool.query=originalQuery;
  assert.equal(called,false);assert.equal(res.statusCode,401);
});

test('forced-change sessions cannot pass role authorization', () => {
  const req={user:{role:'ADMIN',must_change_password:true}},res=createRes();let called=false;
  authorizeRoles('ADMIN')(req,res,()=>{called=true});
  assert.equal(called,false);assert.equal(res.statusCode,403);assert.equal(res.body.error.code,'PASSWORD_CHANGE_REQUIRED');
});

test('unverified Student sessions are rejected from protected APIs', async () => {
  const req={headers:{cookie:'sti_session=unverified'},method:'GET'},res=createRes();let called=false;const originalQuery=pool.query;
  pool.query=async()=>({rows:[{id:7,username:'02000123456',role:'STUDENT',email_verified:false,session_version:1,must_change_password:false,department_id:null}]});
  await authenticateToken(req,res,()=>{called=true});pool.query=originalQuery;
  assert.equal(called,false);assert.equal(res.statusCode,401);
});

test('authenticateToken rejects a forged opaque session generically', async () => {
  const req = { headers: { cookie:'sti_session=forged-token' },method:'GET' };
  const res = createRes();
  let called = false;

  const originalQuery=pool.query;pool.query=async()=>({rows:[]});await authenticateToken(req, res, () => {
    called = true;
  });
  pool.query=originalQuery;

  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});
