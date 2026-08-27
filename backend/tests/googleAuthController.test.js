const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleAuthController } = require('../src/controllers/googleAuthController');
const { ApiError } = require('../src/utils/api');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('Google link controller whitelists and maps the public contract', async () => {
  let input;
  const controller = createGoogleAuthController({ serviceFactory: () => ({ async linkStudent(value) { input = value; return { token: 'jwt', user: { id: 4, username: 'student', role: 'STUDENT' } }; } }) });
  const res = response();
  await controller.link({ body: { credential: 'id-token', student_number: '02000123456', first_name: 'Test', last_name: 'Student' }, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token, 'jwt');
  assert.deepEqual(input, { credential: 'id-token', studentNumber: '02000123456', firstName: 'Test', lastName: 'Student', ipAddress: '127.0.0.1' });
});

test('Google auth controllers reject unsupported and incomplete bodies before service creation', async () => {
  let factories = 0;
  const controller = createGoogleAuthController({ serviceFactory: () => { factories += 1; return {}; } });
  for (const [handler, body] of [[controller.link, { credential: 'x', student_number: '02000123456', first_name: 'A', last_name: 'B', role: 'ADMIN' }], [controller.login, {}]]) {
    const res = response();
    await handler({ body, ip: null }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(factories, 0);
});

test('Google link controller returns accepted without a session for pending enrollment', async () => {
  const controller = createGoogleAuthController({ serviceFactory: () => ({ async linkStudent() { return { pending: true, message: 'Pending review', registration: { id: 8, status: 'PENDING' } }; } }) });
  const res = response();
  await controller.link({ body: { credential: 'id-token', student_number: '02000123456', first_name: 'Test', last_name: 'Student' }, ip: null }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.pending, true);
  assert.equal('token' in res.body, false);
});

test('Google login controller preserves stable service errors and hides unexpected failures', async () => {
  for (const [failure, expectedStatus, expectedCode, expectedMessage] of [[new ApiError(401, 'GOOGLE_LOGIN_FAILED', 'Not linked'), 401, 'GOOGLE_LOGIN_FAILED', 'Not linked'], [new Error('database details'), 500, 'INTERNAL_ERROR', 'Google authentication failed']]) {
    const controller = createGoogleAuthController({ serviceFactory: () => ({ async loginStudent() { throw failure; } }) });
    const res = response();
    await controller.login({ body: { credential: 'id-token' }, ip: null }, res);
    assert.equal(res.statusCode, expectedStatus);
    assert.equal(res.body.error.code, expectedCode);
    assert.equal(res.body.message, expectedMessage);
    assert.equal(JSON.stringify(res.body).includes('database details'), false);
  }
});
