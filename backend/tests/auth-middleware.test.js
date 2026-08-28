const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/database');

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

test('authenticateToken rejects missing bearer token', () => {
  const req = { headers: {} };
  const res = createRes();
  let called = false;

  authenticateToken(req, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
  assert.equal(res.body.success, false);
});

test('authenticateToken accepts valid JWT and attaches current database identity', async () => {
  process.env.JWT_SECRET = 'this-is-a-secure-test-secret-123456';
  const token = jwt.sign({ id: 1, username: 'admin', role: 'STUDENT', session_version: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createRes();
  let called = false;
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ id: 1, username: 'admin', role: 'ADMIN', session_version: 1, must_change_password: false, department_id: null }] });

  await authenticateToken(req, res, () => {
    called = true;
  });

  pool.query = originalQuery;

  assert.equal(called, true);
  assert.equal(req.user.role, 'ADMIN');
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

test('authenticateToken rejects a stale session version', async () => {
  process.env.JWT_SECRET = 'this-is-a-secure-test-secret-123456';
  const token = jwt.sign({ id:1, username:'admin', role:'ADMIN', session_version:1 }, process.env.JWT_SECRET, {expiresIn:'1h'});
  const req={headers:{authorization:`Bearer ${token}`}},res=createRes();let called=false;const originalQuery=pool.query;
  pool.query=async()=>({rows:[{id:1,username:'admin',role:'ADMIN',session_version:2,must_change_password:false,department_id:null}]});
  await authenticateToken(req,res,()=>{called=true});pool.query=originalQuery;
  assert.equal(called,false);assert.equal(res.statusCode,401);assert.equal(res.body.error.code,'SESSION_INVALIDATED');
});

test('forced-change sessions cannot pass role authorization', () => {
  const req={user:{role:'ADMIN',must_change_password:true}},res=createRes();let called=false;
  authorizeRoles('ADMIN')(req,res,()=>{called=true});
  assert.equal(called,false);assert.equal(res.statusCode,403);assert.equal(res.body.error.code,'PASSWORD_CHANGE_REQUIRED');
});

test('authenticateToken fails when JWT secret is missing', async () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  const req = { headers: { authorization: 'Bearer bad-token' } };
  const res = createRes();
  let called = false;

  await authenticateToken(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /JWT_SECRET/i);

  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret;
  }
});
