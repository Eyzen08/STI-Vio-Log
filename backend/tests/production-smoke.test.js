const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOrigin, runProductionSmoke } = require('../scripts/smoke-production');

const response = (status, body = {}, headers = {}) => ({
  status,
  async json() { return body; },
  headers: { get(name) { return headers[name.toLowerCase()] || null; } }
});

test('production smoke requires path-free HTTPS origins', () => {
  assert.equal(normalizeOrigin('https://api.example.test', 'API'), 'https://api.example.test');
  for (const value of ['http://api.example.test', 'https://api.example.test/path', 'not-a-url']) {
    assert.throws(() => normalizeOrigin(value, 'API'), /HTTPS|valid/);
  }
});

test('production smoke checks health, direct routing, auth, and both CORS outcomes without mutations', async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/api/health')) return response(200, { success: true, database: 'connected' });
    if (url.endsWith('/student/login')) return response(200);
    if (url.endsWith('/api/students/me')) return response(401);
    if (options.headers.Origin === 'https://app.example.test') return response(204, {}, { 'access-control-allow-origin': 'https://app.example.test' });
    return response(403);
  };
  const result = await runProductionSmoke({ apiOrigin: 'https://api.example.test', frontendOrigin: 'https://app.example.test', fetchImpl: fakeFetch });
  assert.equal(result.cors, 'passed');
  assert.equal(calls.some((call) => !['GET', 'OPTIONS'].includes(call.options.method || 'GET')), false);
});
