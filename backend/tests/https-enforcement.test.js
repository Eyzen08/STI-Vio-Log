const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceHttps } = require('../src/config/security');

const response = () => ({
  statusCode: null,
  redirectCode: null,
  redirectLocation: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  redirect(code, location) { this.redirectCode = code; this.redirectLocation = location; return this; },
});

test('production HTTP requests redirect permanently to HTTPS', () => {
  const res = response();
  let continued = false;
  enforceHttps({ NODE_ENV: 'production', FRONTEND_URL: 'https://sti-vio-log.vercel.app' })(
    { secure: false, protocol: 'http', originalUrl: '/api/health?full=1', get: () => 'api.example.test' },
    res,
    () => { continued = true; },
  );
  assert.equal(continued, false);
  assert.equal(res.redirectCode, 308);
  assert.equal(res.redirectLocation, 'https://api.example.test/api/health?full=1');
});

test('HTTPS and development requests continue without redirecting', () => {
  for (const request of [
    { environment: { NODE_ENV: 'production' }, secure: true, protocol: 'https' },
    { environment: { NODE_ENV: 'development' }, secure: false, protocol: 'http' },
  ]) {
    const res = response();
    let continued = false;
    enforceHttps(request.environment)({ ...request, originalUrl: '/', get: () => 'localhost:5000' }, res, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(res.redirectCode, null);
  }
});

test('an invalid forwarded host never enters the redirect location', () => {
  const res = response();
  enforceHttps({ NODE_ENV: 'production', FRONTEND_URL: 'https://safe.example.test' })(
    { secure: false, protocol: 'http', originalUrl: '/api/health', get: () => 'bad.example/steal' },
    res,
    () => {},
  );
  assert.equal(res.redirectLocation, 'https://safe.example.test/api/health');
});
