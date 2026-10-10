const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/authRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('auth routes expose password login and rate-limited Google endpoints', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/login' && route.methods.includes('post')));
  assert.equal(routes.some((route) => route.path === '/auth/google/link'), false);
  assert(routes.some((route) => route.path === '/auth/google/login' && route.methods.includes('post')));
  for (const path of ['/auth/student/password/forgot','/auth/student/password/verify','/auth/student/password/reset']) {
    assert(routes.some((route) => route.path === path && route.methods.includes('post')));
  }
  for (const path of ['/auth/student/register','/auth/student/registration/resend','/auth/student/registration/verify']) assert.equal(routes.some((route) => route.path === path), false);
  assert.equal(routes.some((route) => route.path.includes('/department/')), false);
});

test('legal HTTP routes require authentication and CSRF and reject disabled writes', async () => {
  const express = require('express');
  const pool = require('../src/config/database');
  const sessions = require('../src/services/browserSessionService');
  const { legalPolicyManifest, publishedPolicies } = require('../../shared/legalPolicies.mjs');
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const query = pool.query;
  const csrf = 'legal-test-csrf';
  pool.query = async sql => String(sql).startsWith('UPDATE browser_sessions') ? { rows: [] } : { rows: [{ id: 12, username: 'fixture', role: 'DISCIPLINE_ADMIN', browser_session_id: 8, csrf_hash: sessions.hash(csrf, process.env.CSRF_SIGNING_KEY), absolute_expires_at: new Date(Date.now() + 60000) }] };
  try {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(origin + '/api/auth/legal' + (method === 'POST' ? '/acknowledge' : ''), { method });
      assert.equal(response.status, 401);
    }
    const cookie = `sti_session=fixture; ${sessions.CSRF_COOKIE}=${csrf}`;
    const status = await fetch(origin + '/api/auth/legal', { headers: { cookie } });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).legal.required, false);
    const body = JSON.stringify({ acknowledgment_version: legalPolicyManifest.acknowledgmentVersion, terms_version: publishedPolicies.terms.version, privacy_notice_version: publishedPolicies.privacy.version });
    for (const supplied of [undefined, 'forged']) {
      const headers = { cookie, 'Content-Type': 'application/json', ...(supplied ? { 'X-CSRF-Token': supplied } : {}) };
      const response = await fetch(origin + '/api/auth/legal/acknowledge', { method: 'POST', headers, body });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'CSRF_INVALID');
    }
    const headers = { cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
    const disabled = await fetch(origin + '/api/auth/legal/acknowledge', { method: 'POST', headers, body });
    assert.equal(disabled.status, 409);
    assert.equal((await disabled.json()).error.code, 'LEGAL_ACKNOWLEDGMENT_DISABLED');
    const forged = await fetch(origin + '/api/auth/legal/acknowledge', { method: 'POST', headers, body: JSON.stringify({ ...JSON.parse(body), user_id: 99 }) });
    assert.equal(forged.status, 400);
  } finally {
    pool.query = query;
    await new Promise(resolve => server.close(resolve));
  }
});
