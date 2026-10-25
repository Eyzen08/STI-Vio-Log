// Uses bundled Playwright via NODE_PATH; API and Google responses are local fixtures.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const output = fileURLToPath(new URL('../artifacts/responsive-layouts/', import.meta.url))
const student = { id: 1, first_name: 'Alexandria Catherine', last_name: 'Dela Cruz-Santos', student_number: '02000123456', program: 'BSIT', section: 'A303', year_level: 2 }
const violations = ['OPEN', 'OPEN', 'IN_PROGRESS', 'PENDING', 'COMPLETE', 'CLEAR', 'INVALID_CANCEL'].map((status, index) => ({ id: index + 1, student_id: 1, student_name: `${student.first_name} ${student.last_name}`, student_number: student.student_number, incident_date: '2026-10-24', incident_time: '18:22:00', severity: 'MAJOR', status, offense_indicator_level: 'MAJOR_LEVEL', exact_offense: 'Posting content disrespectful to STI or another person, including a long recorded description that must remain readable on smaller screens.' }))
const assignment = { ...student, id: 1, student_id: 1, violation_id: 1, department_id: 1, department_name: 'Community Engagement and Student Support Department', department_head_first_name: 'Alexandria Catherine', department_head_last_name: 'Dela Cruz-Santos', required_hours: 54, remaining_hours: 53.25, status: 'IN_PROGRESS' }
const now = Date.now()
const session = { ...assignment, id: 1, session_id: 1, assignment_id: 1, status: 'ACTIVE', session_type: 'OPEN_TIME', time_in: new Date(now - 1800000).toISOString(), time_out: null, credit_cutoff_at: new Date(now + 3600000).toISOString(), credit_limit_seconds: 5400, elapsed_seconds: 1800, actual_elapsed_seconds: 1800, server_time: new Date(now).toISOString(), supervising_officer_first_name: 'Alexandria Catherine', supervising_officer_last_name: 'Dela Cruz-Santos', supervising_officer_role: 'DEPARTMENT_HEAD' }
const sessions = [session, { ...session, id: 2, session_id: 2, paused_at: new Date(now - 600000).toISOString(), pause_reason: 'Authorized fixture break' }, { ...session, id: 3, session_id: 3, time_in: new Date(now - 86400000).toISOString(), credit_cutoff_at: new Date(now - 3600000).toISOString(), day_ends_at: new Date(now - 3600000).toISOString() }]
const certificates = ['ISSUED', 'REVOKED'].map((status, i) => ({ id: i + 1, student_name: `${student.first_name} ${student.last_name}`, student_number: student.student_number, certificate_number: `STI-GC-COC-20261025-000010-V${i + 1}`, completed_hours: 54, version: i + 1, status, email_status: 'SENT' }))
const conversation = { id: 45, student_id: 1, student_name: `${student.first_name} ${student.last_name}`, student_number: student.student_number, subject: 'Community Service', school_participant: 'Discipline Office', status: 'OPEN' }
const audit = { id: 1, action: 'GOOGLE_LOGIN', actor_name: `${student.first_name} ${student.last_name}`, actor_username: student.student_number, actor_role: 'STUDENT', table_name: 'student_google_accounts', record_id: 4, created_at: new Date(now).toISOString(), context: { subject_name: `${student.first_name} ${student.last_name}`, subject_identifier: student.student_number }, description: 'Student signed in with linked Google identity.' }
const payload = { students: Array.from({ length: 6 }, (_, i) => ({ ...student, id: i + 1 })), violations, assignments: [assignment], sessions: [], notifications: [], departments: [], officers: [], accounts: [], records: [], conversations: [], clearanceRecords: [], violationTypes: [], profile: { username: 'fixture.admin', first_name: 'Juan', last_name: 'Dela Cruz', email: '' }, avatar: { source: 'INITIALS' }, pagination: { total: 0, pages: 1 } }
payload.sessions = sessions
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), cacheDir: `${output}vite-cache`, server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('fixture.apps.googleusercontent.com') } })
await mkdir(output, { recursive: true })
await server.listen()
const origin = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ bypassCSP: true, reducedMotion: 'reduce' })
let user = null
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(() => {
  localStorage.setItem('sti-vio-log-theme', 'dark')
  window.googleInitializations = 0
  window.google = { accounts: { id: {
    initialize() { window.googleInitializations++ },
    renderButton(node, config) {
      const button = document.createElement('button')
      button.textContent = 'Continue with Google'
      button.dataset.providerTheme = config.theme
      button.style.cssText = `width:${config.width}px;height:44px;background:${config.theme === 'outline' ? 'white' : '#202124'};color:${config.theme === 'outline' ? '#202124' : 'white'}`
      node.append(button)
    }
  } } }
})
await page.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.pathname.startsWith('/api/')) {
    let response = url.pathname === '/api/auth/session' ? { user, csrf_token: 'fixture-csrf' } : url.pathname === '/api/auth/legal' ? { legal: { required: false } } : { success: true, ...payload }
    if (url.pathname === '/api/clearance/certificates') response = { certificates }
    if (url.pathname === '/api/clearance/signatures') response = { signatures: [] }
    if (url.pathname === '/api/clearance/certificates/students') response = { students: [] }
    if (url.pathname === '/api/audit-logs') response = { audit_logs: [audit], pagination: { page: 1, limit: 25, total: 1 }, filter_options: { actions: ['GOOGLE_LOGIN'], record_types: ['student_google_accounts'] } }
    if (url.pathname.startsWith('/api/messages/conversations')) response = { conversations: [conversation], conversation, messages: [{ id: 1, message_text: 'Local layout fixture message.', sent_by_me: false, created_at: new Date(now).toISOString(), sender_name: conversation.student_name }], pagination: { pages: 1, total: 1 } }
    await route.fulfill({ status: url.pathname === '/api/auth/session' && !user ? 401 : 200, json: response })
  } else if (url.origin === new URL(origin).origin) await route.continue()
  else await route.abort()
})

async function open(path) {
  await page.context().addCookies([{ name: 'sti_csrf', value: 'fixture-csrf', url: origin }])
  if (new URL(page.url()).origin === new URL(origin).origin) await page.evaluate(user => {
    if (user) localStorage.setItem('sti_vio_log_user', JSON.stringify(user))
    else localStorage.removeItem('sti_vio_log_user')
  }, user)
  await page.goto(new URL(path, origin).href)
  await page.locator('.route-loading, .dashboard-loading').waitFor({ state: 'hidden' })
}
async function theme(value) {
  if (await page.locator('html').getAttribute('data-theme') !== value) await page.getByRole('button', { name: `Switch to ${value === 'dark' ? 'Dark' : 'Light'} Mode`, exact: true }).first().click()
  await page.waitForFunction(value => document.documentElement.dataset.theme === value && !document.documentElement.classList.contains('theme-transitioning'), value)
}
async function fits(selector) {
  const result = await page.locator(selector).evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }))
  assert.ok(result.scroll <= result.width + 1, `${selector} overflows: ${JSON.stringify(result)}`)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Document must not scroll horizontally')
}
async function inside(selector, parent) {
  const outer = await page.locator(parent).boundingBox()
  for (const box of await page.locator(selector).evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right } }))) assert.ok(box.x >= outer.x - 1 && box.right <= outer.x + outer.width + 1, `${selector} clipped`)
}

try {
  for (const width of [360, 390, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await open('/login')
    await page.locator('.google-button button').waitFor()
    for (const value of ['light', 'dark']) {
      await theme(value)
      await fits('.login-page')
      assert.equal(await page.locator('.google-button').evaluate(el => getComputedStyle(el).colorScheme), 'normal', 'Google iframe padding must keep a transparent canvas in both app themes')
      assert.equal(await page.locator('.google-button button').getAttribute('data-provider-theme'), value === 'dark' ? 'filled_black' : 'outline')
      assert.equal(await page.evaluate(() => window.googleInitializations), 1, 'Theme changes must not initialize Google again')
      const position = await page.locator('.login-intro').evaluate(el => getComputedStyle(el).position)
      assert.equal(position, width <= 1023 ? 'absolute' : 'sticky')
      if (width <= 1023) {
        const background = await page.locator('.login-intro').boundingBox()
        const form = await page.locator('.login-card').boundingBox()
        assert.ok(background.y <= form.y && background.y + background.height >= form.y + form.height, 'Campus background covers the form')
      } else {
        assert.match(await page.locator('.login-intro h2').innerText(), /Discipline with purpose\.\s*Progress with confidence\./)
        await fits('.login-intro-content')
      }
      await page.screenshot({ path: `${output}login-${value}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
  }

  user = { id: 1, role: 'DISCIPLINE_ADMIN', username: 'fixture.admin', full_name: 'Juan Dela Cruz' }
  for (const width of [360, 390, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [path, wrap, table, query, limit] of [
      ['/admin/students', '.student-directory-table-wrap', '.student-directory-table', 'student-records', 1024],
      ['/admin/violations', '.violation-table-wrap', '.violation-table', 'violation-records', 1184],
      ['/admin/community-service', '.service-table-wrap', '.service-tracking-table', 'service-records', 1152],
      ['/admin/active-attendance', '.active-attendance-table-wrap', '.active-attendance-table', 'active-attendance', 1184]
    ]) {
      await open(path)
      await page.locator(`${table} tbody tr [data-label]`).first().waitFor()
      for (const value of ['light', 'dark']) {
        await theme(value)
        for (const collapsed of width >= 768 ? [false, true] : [false]) {
          if (width >= 768 && await page.locator('.app-shell').evaluate(el => el.classList.contains('sidebar-collapsed')) !== collapsed) await page.getByRole('button', { name: collapsed ? 'Collapse Navigation' : 'Expand Navigation', exact: true }).click()
          await fits(wrap)
          await inside(`${table} button`, wrap)
          const layout = await page.locator(table).evaluate(el => getComputedStyle(el.querySelector('tbody tr')).display)
          const available = await page.locator(wrap).evaluate(el => el.clientWidth)
          assert.equal(layout, available <= limit ? 'grid' : 'table-row', `${query} must follow available width`)
          if (path.endsWith('violations')) {
            const firstId = await page.locator(`${table} tbody td[data-label='ID']`).first().innerText()
            await page.getByRole('button', { name: /Sort Incident Date/ }).click()
            assert.notEqual(await page.locator(`${table} tbody td[data-label='ID']`).first().innerText(), firstId, 'Sorting remains usable in table and card layouts')
            await page.getByRole('button', { name: /Sort Incident Date/ }).click()
            assert.equal(await page.locator('.violation-records-card').evaluate(el => getComputedStyle(el).boxShadow), 'none')
            if (layout === 'grid') {
              assert.equal(await page.locator(`${table} tbody td`).first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
              assert.equal(await page.locator('.violation-offense').first().evaluate(el => el.scrollHeight > el.clientHeight), false)
            }
          } else if (path.endsWith('students')) {
            await page.locator('.row-action-trigger').first().click()
            await inside('.student-account-menu', 'body')
            await page.keyboard.press('Escape')
          }
          if (layout === 'grid') {
            const row = page.locator(`${table} tbody tr`).first()
            await row.hover({ position: { x: 20, y: 20 } })
            assert.equal(await row.evaluate(el => getComputedStyle(el).boxShadow), 'none', `${query}: flat record card`)
            assert.ok((await row.locator('td').evaluateAll(nodes => nodes.map(el => getComputedStyle(el).backgroundColor))).every(color => color === 'rgba(0, 0, 0, 0)'), `${query}: cells share the row background on hover`)
          }
          if (path.endsWith('active-attendance') && layout === 'grid') assert.equal(await page.locator(wrap).evaluate(el => getComputedStyle(el).maxHeight), 'none')
          await page.screenshot({ path: `${output}${query}-${value}-${width}-${collapsed}.png`, fullPage: true, animations: 'disabled' })
        }
      }
    }
  }

  for (const width of [360, 390, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [path, table] of [['/admin/clearance?panel=history', '.clearance-panel[data-panel="history"] .management-record-table'], ['/admin/audit-log', '.audit-record-table']]) {
      await open(path)
      await page.locator(`${table} tbody tr`).first().waitFor()
      for (const value of ['light', 'dark']) {
        await theme(value)
        await fits('.page-content')
        const row = page.locator(`${table} tbody tr`).first()
        if (await row.evaluate(el => getComputedStyle(el).display) === 'grid') {
          await row.hover({ position: { x: 20, y: 20 } })
          assert.equal(await row.evaluate(el => getComputedStyle(el).boxShadow), 'none')
          assert.ok((await row.locator('td').evaluateAll(nodes => nodes.map(el => getComputedStyle(el).backgroundColor))).every(color => color === 'rgba(0, 0, 0, 0)'), 'Shared card cells must remain transparent on hover')
          await inside(`${table} button`, '.page-content')
        }
        await page.screenshot({ path: `${output}${path.includes('clearance') ? 'certificates' : 'audit'}-${value}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    for (const role of ['DISCIPLINE_ADMIN', 'STUDENT']) {
      user = { ...user, role }
      await open(`${role === 'STUDENT' ? '/student' : '/admin'}/messages?conversation_id=45`)
      await page.locator('.chat-composer textarea').waitFor()
      for (const value of ['light', 'dark']) {
        await theme(value)
        await fits('.main-panel--messages')
        const sync = await page.locator('.attendance-sync').boundingBox()
        assert.ok(sync.height <= 100, 'Sync notice must use its natural height')
        const composer = await page.locator('.chat-composer').boundingBox()
        assert.ok(composer.y >= 0 && composer.y + composer.height <= 1000, 'Message composer stays in the viewport')
        if (role === 'STUDENT') assert.equal(await page.locator('.attendance-notice-region').evaluate(el => getComputedStyle(el).position), 'static', 'Student notices reserve height in Messages')
        await page.screenshot({ path: `${output}messages-${role}-${value}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    user = { ...user, role: 'DISCIPLINE_ADMIN' }
  }

  await page.setViewportSize({ width: 1920, height: 1000 })
  await open('/admin/dashboard')
  await page.locator('.dashboard-case-status').waitFor()
  for (const value of ['light', 'dark']) {
    await theme(value)
    await fits('.admin-dashboard')
    assert.deepEqual(await page.locator('.dashboard-case-status dd').allTextContents(), ['2', '1', '1', '2'])
    await page.screenshot({ path: `${output}dashboard-${value}.png`, fullPage: true, animations: 'disabled' })
  }

  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']) {
    user = { ...user, role }
    await page.setViewportSize({ width: 1024, height: 1000 })
    await open(role === 'DEPARTMENT_HEAD' ? '/department/account-settings' : '/admin/account-settings')
    await page.locator('#account-security summary').click()
    for (const value of ['light', 'dark']) {
      await theme(value)
      for (const input of await page.locator('.account-password-form input').all()) {
        const field = await input.boundingBox()
        const button = input.locator('..').getByRole('button')
        const eye = await button.boundingBox()
        assert.ok(Math.abs(field.y + field.height / 2 - eye.y - eye.height / 2) <= 1, `${role}: eye centered`)
        assert.ok(eye.x >= field.x && eye.x + eye.width <= field.x + field.width, `${role}: eye inside field`)
        await button.click()
        assert.equal(await input.getAttribute('type'), 'text')
        await button.click()
        assert.equal(await input.getAttribute('type'), 'password')
      }
      await page.screenshot({ path: `${output}password-${role}-${value}.png`, fullPage: true, animations: 'disabled' })
    }
  }
  assert.deepEqual(errors, [])
  console.log('Responsive layouts passed: 6 widths, both themes, sidebar states, Google theme lifecycle, and 3 staff password forms.')
} catch (error) {
  console.error(await page.evaluate(() => {
    const element = document.querySelector('.service-tracking-table tbody td,.active-attendance-table tbody td,.violation-table tbody td,.audit-record-table tbody td')
    if (!element) return location.pathname
    const matches = []
    const visit = rules => { for (const rule of rules) {
      if (rule.selectorText && rule.style?.background && element.matches(rule.selectorText)) matches.push(`${rule.selectorText} { background:${rule.style.background} ${rule.style.getPropertyPriority('background')} }`)
      if (rule.cssRules) visit(rule.cssRules)
    } }
    for (const sheet of document.styleSheets) { try { visit(sheet.cssRules) } catch { /* External provider sheets are inaccessible. */ } }
    return matches
  }))
  await page.screenshot({ path: `${output}failure.png`, fullPage: true, animations: 'disabled' })
  throw error
} finally {
  await browser.close()
  await server.close()
}
