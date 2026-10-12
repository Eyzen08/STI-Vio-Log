// Browser checks use synthetic sessions and API fixtures only.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const artifacts = new URL('../artifacts/landing-redesign/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') } })
await server.listen()
const origin = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = []
const results = []
const user = { id: 77, role: 'STUDENT', username: 'sample.student', first_name: 'Sample', last_name: 'Student' }
const contextFor = async ({ storedUser = null, session = 'valid', theme = 'light', holdSession = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const requests = []
  let release
  const held = holdSession ? new Promise(resolve => { release = resolve }) : Promise.resolve()
  await context.addInitScript(({ storedUser, theme }) => {
    localStorage.setItem('sti-vio-log-theme', theme)
    if (storedUser) localStorage.setItem('sti_vio_log_user', JSON.stringify(storedUser))
  }, { storedUser, theme })
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    let status = 200
    let data = { success: true, students: [], violations: [], assignments: [], sessions: [], notifications: [], clearance: [], departments: [], officers: [], unread_total: 0 }
    if (path === '/api/auth/session') {
      await held
      status = session === 'expired' ? 401 : session === 'error' ? 503 : 200
      data = { user: storedUser, csrf_token: 'sample-csrf' }
    } else if (path === '/api/auth/legal') data = { legal: { required: false, documents: [] } }
    else if (path === '/api/public/legal') data = { documents: [] }
    else if (path === '/api/students/me') data = { student: { id: 77, student_number: 'SAMPLE', first_name: 'Sample', last_name: 'Student' } }
    else if (path.includes('/dtr')) data = { summary: {}, entries: [], assignments: [], sessions: [] }
    else if (path.includes('/eligibility')) data = { eligible: false, blockers: [] }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': new URL(origin).origin, 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(data) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Know your next step.', exact: true }).waitFor()
  return { context, page, requests, release }
}
const fits = async page => {
  const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
  assert.ok(size.content <= size.width, `Horizontal overflow: ${JSON.stringify(size)}`)
}
const shot = async (page, name, fullPage = false) => {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, artifacts)), fullPage })
}

try {
  const guest = await contextFor()
  const { page, requests } = guest
  await page.getByRole('button', { name: 'Pause Motion', exact: true }).click()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.getByRole('tab', { name: 'Records', exact: true }).click()
  await page.getByText('Uniform requirement', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Records', exact: true }).press('ArrowRight')
  assert.equal(await page.getByRole('tab', { name: 'My Service', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '6')
  await page.getByRole('tab', { name: 'Clearance', exact: true }).click()
  await page.getByText('6 hrs left', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Clearance', exact: true }).press('Home')
  assert.equal(await page.getByRole('tab', { name: 'Records', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('tab', { name: 'My Service', exact: true }).click()
  assert.equal(await page.locator('.landing-page').getAttribute('data-motion'), 'paused')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  for (const width of [360, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await fits(page)
    await shot(page, `landing-${width}`, width === 1366)
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('sti-vio-log-theme')), 'light')
  assert.equal(requests.length, 0, 'Guest browsing must not call the API')
  assert.equal(await page.locator('script[src*="accounts.google.com"]').count(), 0)
  assert.equal(await page.locator('.sidebar,.topbar,.setup-brand,.auth-theme-toggle').count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('link', { name: 'FAQs', exact: true }).click()
  assert.equal(new URL(page.url()).hash, '#faqs')
  await page.locator('summary').filter({ hasText: 'How do I sign in for the first time?' }).click()
  assert.equal(await page.locator('details[open]').count(), 1)
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: 'Open navigation menu' }).getAttribute('aria-expanded'), 'false')
  await page.getByRole('link', { name: 'Privacy Notice', exact: true }).click()
  assert.equal(new URL(page.url()).pathname, '/privacy')
  await page.getByRole('button', { name: /return|back/i }).first().click()
  await page.getByRole('heading', { name: 'Know your next step.', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Sign In', exact: true }).last().click()
  await page.getByRole('heading', { name: /^welcome back$/i }).waitFor()
  await fits(page)
  await shot(page, 'login-light-390')
  await page.setViewportSize({ width: 1366, height: 900 })
  await shot(page, 'login-light-1366')
  await page.getByRole('button', { name: /Switch to Dark Mode/i }).click()
  await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transitioning'))
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.login-submit')).color === 'rgb(7, 20, 33)')
  await shot(page, 'login-dark-1366')
  assert.equal(await page.locator('.login-submit').evaluate(node => getComputedStyle(node).color), 'rgb(7, 20, 33)')
  for (const width of [360, 390, 768, 1920]) { await page.setViewportSize({ width, height: 900 }); await fits(page) }
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'login-dark-390')
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click()
  await page.getByRole('heading', { name: 'Know your next step.', exact: true }).waitFor()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('.landing-preview-panel:not([hidden])').evaluate(node => getComputedStyle(node).animationName), 'none')
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto')
  await page.getByRole('button', { name: 'Pause Motion', exact: true }).click()
  await guest.context.close()
  results.push('Guest browsing, preview keyboard interaction, menu, FAQ, policy return, login themes, reduced motion, five widths')

  for (const role of ['STUDENT', 'DEPARTMENT_HEAD', 'DISCIPLINE_OFFICE', 'DISCIPLINE_ADMIN']) {
    const signed = await contextFor({ storedUser: { ...user, role } })
    try { await signed.page.getByRole('link', { name: 'Open My Portal', exact: true }).first().waitFor() }
    catch (error) { console.error('Session fixture diagnostic', role, signed.requests, await signed.page.locator('.landing-session-note').allTextContents()); throw error }
    assert.equal(new URL(signed.page.url()).pathname, '/')
    assert.ok(signed.requests.every(path => ['/api/auth/session', '/api/auth/legal'].includes(path)), signed.requests.join(', '))
    assert.equal(await signed.page.locator('.sidebar,.topbar,.setup-brand').count(), 0)
    await signed.context.close()
  }
  results.push('All four signed-in roles stay on landing; private data and realtime UI remain absent')
  for (const flag of ['password_change_required', 'onboarding_required']) {
    const setup = await contextFor({ storedUser: { ...user, [flag]: true } })
    await setup.page.getByRole('link', { name: 'Open My Portal', exact: true }).first().click()
    await setup.page.waitForURL(`**/${flag === 'password_change_required' ? 'account/password-change' : 'student/onboarding'}`)
    await setup.context.close()
  }
  const expired = await contextFor({ storedUser: user, session: 'expired' })
  await expired.page.getByRole('link', { name: 'Sign In', exact: true }).first().waitFor()
  assert.equal(new URL(expired.page.url()).pathname, '/')
  await expired.context.close()
  const unavailable = await contextFor({ storedUser: user, session: 'error' })
  await unavailable.page.getByText('Your session could not be verified.', { exact: false }).waitFor()
  await unavailable.page.getByRole('link', { name: 'Sign In', exact: true }).first().click()
  await unavailable.page.getByRole('button', { name: /try again/i }).waitFor()
  await unavailable.context.close()
  const restoring = await contextFor({ storedUser: user, holdSession: true })
  await restoring.page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await restoring.page.getByRole('button', { name: 'Checking Session…', exact: true }).first().isDisabled(), true)
  await restoring.page.getByRole('tab', { name: 'Records', exact: true }).click()
  restoring.release()
  await restoring.page.getByRole('link', { name: 'Open My Portal', exact: true }).first().waitFor()
  await restoring.context.close()
  results.push('Setup redirects preserved; expired, failed, and pending sessions remain browsable')
  assert.deepEqual(errors, [])
  console.log(results.map(result => `PASS: ${result}`).join('\n'))
} finally {
  await browser.close()
  await server.close()
}
