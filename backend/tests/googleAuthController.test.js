const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleAuthController } = require('../src/controllers/googleAuthController');
const { ApiError } = require('../src/utils/api');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
test('Google auth controllers reject unsupported and incomplete bodies before service creation', async () => {
  let factories = 0;
  const controller = createGoogleAuthController({ serviceFactory: () => { factories += 1; return {}; } });
  for (const [handler, body] of [[controller.login, { credential: 'x', role: 'ADMIN' }], [controller.login, {}]]) {
    const res = response();
    await handler({ body, ip: null }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(factories, 0);
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

test('public Google controller has no linking handler', () => { assert.equal(createGoogleAuthController().link, undefined); });

test('Google login uses the session created in its transaction without exposing the cookie token', async () => {
  const controller = createGoogleAuthController({ serviceFactory: () => ({ async loginStudent(input) {
    assert.equal(input.userAgent, 'test-browser');
    return { user: { id: 1 }, session: { token: 'private-cookie-token', csrf: 'csrf-token' } };
  } }) });
  const res = response(), cookies = [];
  res.append = (name, value) => cookies.push([name, value]);
  await controller.login({ body: { credential: 'id-token' }, get: () => 'test-browser' }, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.csrf_token, 'csrf-token');
  assert.equal(JSON.stringify(res.body).includes('private-cookie-token'), false);
  assert(cookies.some(([name, value]) => name === 'Set-Cookie' && value.startsWith('sti_session=')));
});
