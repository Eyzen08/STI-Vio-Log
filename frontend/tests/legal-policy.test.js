import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { legalPolicyManifest, publishedPolicies } from '../../shared/legalPolicies.mjs'
import { legalAccessState, policyReturnPath } from '../src/lib/legalPolicy.js'

test('the release keeps mandatory acknowledgment disabled', () => {
  assert.equal(legalPolicyManifest.enforcementEnabled, false)
  assert.equal(publishedPolicies.privacy.title, 'Privacy Notice')
  assert.match(publishedPolicies.privacy.sections.flat().join(' '), /cookies/i)
  assert.doesNotMatch(publishedPolicies.privacy.sections.flat().join(' '), /stores the signed-in session in browser storage/)
})

test('legal status blocks access until the authenticated account has been verified', () => {
  assert.equal(legalAccessState(null, 12).ready, false)
  assert.equal(legalAccessState({ userId: 13, status: { required: false } }, 12).ready, false)
  assert.equal(legalAccessState({ userId: 12, status: { required: false } }, 12).ready, true)
  assert.equal(legalAccessState({ userId: 12, status: { required: true } }, 12).required, true)
  assert.equal(legalAccessState({ userId: 12, error: 'offline' }, 12).ready, false)
  assert.equal(legalAccessState({ userId: 12, status: {} }, 12).ready, false)
})

test('policy return locations preserve queries and fragments and reject external destinations', () => {
  assert.equal(policyReturnPath('?return=%2Fstudent%2Faccount-settings%3Fsection%3Dsecurity%23account-security', '/login'), '/student/account-settings?section=security#account-security')
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/a/..//evil.test/path', '/%2e%2e//evil.test/path', '/privacy', '/terms?return=/privacy']) {
    assert.equal(policyReturnPath(`?return=${encodeURIComponent(value)}`, '/student/dashboard'), '/student/dashboard')
  }
})

test('analytics is not loaded and login exposes links without legal checkboxes', async () => {
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(main, /@vercel\/analytics|<Analytics/)
  const login = await readFile(new URL('../src/components/LoginPage.jsx', import.meta.url), 'utf8')
  assert.match(login, />Privacy Notice<\/a>/)
  assert.match(login, /href="\/terms"/)
  assert.doesNotMatch(login, /type="checkbox"/)
})

test('restored QR scans wait for verified legal access and public policies remain available during restoration', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /if\(!portalReady\|\|activeView!=='QR Scan'/)
  assert.match(app, /\},\[portalReady,activeView,token,user\?\.id,realtimeSocket\]\)/)
  const rendering = app.slice(app.indexOf('const renderContent'))
  assert.ok(rendering.indexOf("if (routePath === '/privacy'") < rendering.indexOf('if (sessionRestoring)'))
})
