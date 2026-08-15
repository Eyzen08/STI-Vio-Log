const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

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

test('authenticateToken accepts valid JWT and attaches user', () => {
  process.env.JWT_SECRET = 'this-is-a-secure-test-secret-123456';
  const token = jwt.sign({ id: 1, username: 'admin', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createRes();
  let called = false;

  authenticateToken(req, res, () => {
    called = true;
  });

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

test('authenticateToken fails when JWT secret is missing', () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  const req = { headers: { authorization: 'Bearer bad-token' } };
  const res = createRes();
  let called = false;

  authenticateToken(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /JWT_SECRET/i);

  if (originalSecret) {
    process.env.JWT_SECRET = originalSecret;
  }
});
