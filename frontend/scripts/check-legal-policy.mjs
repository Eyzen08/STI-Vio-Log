// Run with the bundled Playwright package available through NODE_PATH.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { legalPolicyManifest, publishedPolicies } from '../../shared/legalPolicies.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')
const output = fileURLToPath(new URL('../artifacts/legal-policy/', import.meta.url))
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0, hmr: false } })
const fixture = { students: [], violations: [], assignments: [], notifications: [], sessions: [], records: [], conversations: [], recipients: [], messages: [], results: [], departments: [], destinations: [], officers: [], violationTypes: [], clearanceRecords: [], corrections: [], rows: [], entries: [], summary: {}, unread_total: 0 }
let browser
let mode = 'disabled'
let user = null
let accepted = false
let failure = ''
let protectedRequests = []
const requests = []
const errors = []
const status = () => ({ enforcement_enabled: mode !== 'disabled', required: mode !== 'disabled' && !accepted, acknowledgment_version: legalPolicyManifest.acknowledgmentVersion, terms_version: publishedPolicies.terms.version, privacy_notice_version: publishedPolicies.privacy.version, acknowledged_at: accepted ? '2026-10-10T00:00:00Z' : null, documents: publishedPolicies })

try {
  await mkdir(output, { recursive: true })
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  const localOrigin = new URL(origin).origin
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const newPage = async (width) => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, bypassCSP: true })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    if (user) await page.addInitScript((account) => {
      localStorage.setItem('sti_vio_log_user', JSON.stringify(account))
      sessionStorage.setItem('service-attendance-qr:' + account.id, 'fixture-qr')
    }, user)
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/')) {
        let response = fixture
        let code = 200
        if (url.pathname === '/api/auth/session') { response = { user, csrf_token: 'fixture-csrf' }; code = user ? 200 : 401 }
        else if (url.pathname === '/api/auth/csrf') response = { csrf_token: 'fixture-csrf' }
        else if (url.pathname === '/api/auth/legal') {
          await new Promise(resolve => setTimeout(resolve, 100))
          response = { legal: status() }
          if (mode === 'offline') { response = { message: 'Unable to verify Terms acknowledgment' }; code = 503 }
        } else if (url.pathname === '/api/auth/legal/acknowledge') {
          const body = route.request().postDataJSON()
          assert.deepEqual(body, { acknowledgment_version: status().acknowledgment_version, terms_version: status().terms_version, privacy_notice_version: status().privacy_notice_version })
          if (failure) { response = { error: { code: failure === 'stale' ? 'LEGAL_POLICY_CHANGED' : 'LEGAL_ACKNOWLEDGMENT_FAILED', message: failure === 'stale' ? 'The policies have changed. Review the current documents and try again' : 'Unable to save Terms acknowledgment. Please try again' } }; code = failure === 'stale' ? 409 : 503; failure = '' }
          else { accepted = true; response = { legal: status() } }
        } else protectedRequests.push(url.pathname)
        if (url.pathname === '/api/account/admin-profile') response = { profile: { first_name: 'Test', last_name: 'User', username: 'fixture', email: '', email_verified: true } }
        await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify({ success: code < 400, ...response }) })
      } else if (url.pathname.startsWith('/socket.io/') || url.origin !== localOrigin) await route.abort()
      else await route.continue()
    })
    return page
  }
  const fits = async (page) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'page must not overflow horizontally')

  for (const width of [390, 1280]) {
    user = null
    const page = await newPage(width)
    await page.goto(origin + 'login')
    await page.getByRole('link', { name: 'Privacy Notice', exact: true }).click()
    await page.getByRole('heading', { name: 'Privacy Notice', exact: true }).waitFor()
    assert.equal(await page.locator('time[datetime="2026-10-10"]').count(), 1)
    await fits(page)
    await page.screenshot({ path: output + `privacy-${width}.png`, fullPage: true })
    await page.getByRole('navigation', { name: 'Legal pages' }).getByRole('link', { name: 'Terms of Use' }).click()
    await page.getByRole('heading', { name: 'Terms of Use', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Return', exact: true }).first().click()
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor()
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0)
    await page.close()
  }

  for (const role of ['STUDENT', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'DISCIPLINE_ADMIN']) {
    user = { id: 12, username: 'fixture', role, first_name: 'Test', last_name: 'User' }
    const prefix = role === 'STUDENT' ? 'student' : role === 'DEPARTMENT_HEAD' ? 'department' : 'admin'
    const location = `/${prefix}/account-settings?section=security#account-security`
    mode = 'disabled'; accepted = false
    const page = await newPage(390)
    await page.goto(origin + location.slice(1))
    const privacyLink = page.getByRole('navigation', { name: 'Privacy and terms' }).getByRole('link', { name: 'Privacy Notice' })
    assert.equal(new URL(await privacyLink.getAttribute('href'), origin).searchParams.get('return'), location)
    await privacyLink.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Privacy Notice', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Return', exact: true }).first().click()
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash, location)
    await page.close()

    mode = 'required'; accepted = false; protectedRequests = []
    const gate = await newPage(role === 'STUDENT' ? 390 : 1280)
    await gate.goto(origin + (role === 'STUDENT' ? 'student/dashboard' : `${prefix}/qr-scan`))
    await gate.getByRole('button', { name: 'Acknowledge Terms and continue' }).waitFor()
    assert.deepEqual(protectedRequests, [], 'no dashboard, QR, polling or other protected requests before acknowledgment')
    await fits(gate)
    await gate.screenshot({ path: output + `acknowledgment-${role}.png`, fullPage: true })
    if (role === 'STUDENT') {
      failure = 'save'
      await gate.getByRole('button', { name: 'Acknowledge Terms and continue' }).click()
      await gate.getByRole('alert').filter({ hasText: 'Unable to save Terms acknowledgment' }).waitFor()
      assert.equal(accepted, false)
      assert.deepEqual(protectedRequests, [])
      failure = 'stale'
      await gate.getByRole('button', { name: 'Acknowledge Terms and continue' }).click()
      await gate.getByRole('alert').filter({ hasText: 'The policies have changed' }).waitFor()
      await gate.getByRole('button', { name: 'Acknowledge Terms and continue' }).waitFor()
    }
    await gate.getByRole('button', { name: 'Acknowledge Terms and continue' }).click()
    await gate.getByRole('heading', { name: 'Terms of Use', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(accepted, true)
    await gate.waitForTimeout(250)
    await gate.reload()
    await gate.getByRole('heading', { name: 'Terms of Use', exact: true }).waitFor({ state: 'hidden' })
    await gate.close()
  }

  mode = 'required'; accepted = false; protectedRequests = []
  user = { id: 12, username: 'fixture', role: 'STUDENT', password_change_required: true, onboarding_required: true, onboarding_step: 'PROFILE' }
  const password = await newPage(390)
  await password.goto(origin + 'student/dashboard')
  await password.getByRole('heading', { name: 'Create a new password' }).waitFor()
  assert.equal(await password.getByRole('button', { name: 'Acknowledge Terms and continue' }).count(), 0)
  assert.deepEqual(protectedRequests, [])
  await password.close()
  user = { ...user, password_change_required: false }
  const onboarding = await newPage(390)
  await onboarding.goto(origin + 'student/dashboard')
  await onboarding.getByRole('button', { name: 'Acknowledge Terms and continue' }).click()
  await onboarding.getByRole('heading', { name: 'Finish securing your student account' }).waitFor()
  assert.deepEqual(protectedRequests, [])
  await onboarding.close()

  mode = 'offline'; user = { id: 12, username: 'fixture', role: 'STUDENT' }; protectedRequests = []
  const offline = await newPage(390)
  await offline.goto(origin + 'student/dashboard')
  await offline.getByRole('button', { name: 'Try again' }).waitFor()
  assert.deepEqual(protectedRequests, [])
  mode = 'disabled'
  await offline.getByRole('button', { name: 'Try again' }).click()
  await offline.getByRole('heading', { name: 'Checking account access' }).waitFor({ state: 'hidden' })
  await offline.close()

  assert.deepEqual(errors, [])
  assert.equal(requests.some(url => /_vercel\/insights|va\.vercel-scripts|vitals\.vercel-insights/.test(url)), false)
  console.log('Legal browser checks passed: public links, mobile/desktop layout, every role, return URLs, gated QR/data requests, save retry, stale versions, repeat sessions, and no analytics requests.')
} finally {
  await browser?.close()
  await server.close()
}
