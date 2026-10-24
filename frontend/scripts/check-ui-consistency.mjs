// Run with Playwright available locally or through NODE_PATH (no app dependency).
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { APP_ROUTES, PUBLIC_ROUTES } from '../src/lib/routes.js'
import { auditThemeColors } from './lib/themeAudit.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL(process.argv.includes('--theme-audit') ? '../artifacts/theme-audit/' : '../artifacts/ui-consistency/', import.meta.url))
const student = { id: 1, first_name: 'Maria', last_name: 'Santos', full_name: 'Maria Santos', student_name: 'Maria Santos', student_number: '2024-001', username: 'maria', program: 'BSIT', year_level: 2, section: 'A303', email: 'maria@example.com', email_verified: true, qualification_status: 'NEEDS_SERVICE' }
const violation = { id: 1, student_id: 1, student_name: 'Maria Santos', student_number: '2024-001', exact_offense: 'Non-wearing, incomplete, or improper use of school uniform or ID', incident_date: '2026-10-05', severity: 'MINOR', status: 'OPEN', offense_indicator_level: 'MINOR_1' }
const assignment = { id: 1, assignment_id: 1, violation_id: 1, student_id: 1, student_name: 'Maria Santos', first_name: 'Maria', last_name: 'Santos', student_number: '2024-001', required_hours: 4, remaining_hours: 2, department_name: 'Community Engagement and Student Support Department', status: 'IN_PROGRESS' }
const payload = { students: [student, { ...student, id: 2, first_name: 'Rafael', last_name: 'Cruz', student_number: '2024-002' }, { ...student, id: 3, first_name: 'Ana', last_name: 'Reyes', student_number: '2024-003' }], student, profile: student, violations: [violation], assignments: [assignment], sessions: [], notifications: [], summary: {}, destinations: [], departments: [], officers: [], accounts: [], records: [], rows: [], entries: [], logs: [], conversations: [], recipients: [], messages: [], violationTypes: [], clearanceRecords: [{ id: 1, student_id: 2, status: 'CLEARED' }], corrections: [], results: [], pagination: { page: 1, totalPages: 1, total: 1 } }
const clearanceFixtures = ['AWAITING_CLEARANCE', 'QUALIFIED', 'BLOCKED', 'NEEDS_SERVICE', 'NO_SERVICE_REQUIRED', 'QUALIFIED', 'AWAITING_CLEARANCE'].map((status, i) => ({
  ...student, id: i + 1, student_name: ['Maria Santos', 'Rafael Cruz', 'Ana Reyes', 'Luis Tan', 'Bea Lim', 'Paolo Sy', 'Isabel Garcia'][i],
  student_number: `2024-00${i + 1}`, qualification_status: status, qualification_reason: status === 'BLOCKED' ? 'Has an unresolved violation.' : status === 'AWAITING_CLEARANCE' ? 'Service is complete; final clearance approval is still required.' : 'Community service status verified.',
  academic_level: 'COLLEGE', assignment_count: status === 'NO_SERVICE_REQUIRED' ? 0 : 1, required_hours: 4, completed_hours: status === 'NEEDS_SERVICE' ? 1 : 4,
  service_complete: !['NEEDS_SERVICE', 'NO_SERVICE_REQUIRED'].includes(status), certificate_eligible: status === 'QUALIFIED', has_issued_certificate: i === 5,
  clearance_id: i === 6 ? null : i + 1, academic_year: '2026-2027', semester: '1st Semester',
}))
let clearanceStudents = structuredClone(clearanceFixtures)
let rejectApproval = false
let rejectDirectory = false
const approvalBodies = []
const signature = { id: 1, full_name: 'Juan Dela Cruz', position: 'Discipline Officer', is_active: true, updated_at: '2026-10-08', image_data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=' }
const clearanceCertificates = ['ISSUED', 'REVOKED'].map((status, i) => ({ id: i + 1, student_name: 'Paolo Sy', student_number: '2024-006', certificate_number: `STI-2026-00${i + 1}`, version: i + 1, completed_hours: 4, status, email_status: 'SENT' }))
const server = await createServer({ root, cacheDir: `${output}vite-cache-${process.argv.includes('--flows-only') ? 'flows' : process.argv.includes('--message-flow') ? 'messages' : process.argv.includes('--report-flows') ? 'reports' : 'routes'}`, server: { host: '127.0.0.1', port: 0, hmr: false } })
let browser, page
let user
const errors = []
const themeFindings = []
const themeManualReview = []
const themeCoverage = []
const coverage = []
let degraded = false
let reportMode = 'populated'
const reportRequests = []
const messageFlow = process.argv.includes('--message-flow')
const themeAuditSuffix = messageFlow ? '-messages' : process.argv.includes('--flows-only') ? '-flows' : process.argv.includes('--report-flows') ? '-reports' : ''
let threadMessages = []
const representativeRoutes = new Set(['/admin/dashboard', '/admin/students', '/admin/system-monitoring', '/admin/messages', '/admin/qr-scan', '/admin/account-settings', '/department/dashboard', '/department/students', '/department/dtr', '/department/qr-scan', '/student/dashboard', '/student/profile', '/student/community-service', '/student/clearance', '/student/messages'])

try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  page = await browser.newPage({ bypassCSP: true, reducedMotion:process.argv.includes('--theme-audit') ? 'reduce' : 'no-preference' })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      if (messageFlow && url.pathname.startsWith('/api/messages/')) {
        const conversation = { id:45, student_name:'Maria Santos', student_number:student.student_number, subject:'Service schedule', school_participant:'Discipline Office', status:'OPEN' }
        if (url.pathname.endsWith('/messages') && route.request().method() === 'POST') {
          threadMessages.push({ id:threadMessages.length + 1, message_text:route.request().postDataJSON().message, sent_by_me:true, created_at:'2026-10-24T02:00:00Z', sender_name:'Fixture User' })
        }
        await route.fulfill({ json:url.pathname === '/api/messages/conversations' ? { conversations:[conversation], pagination:{ pages:1,total:1 } } : { conversation, messages:threadMessages, pagination:{ pages:1 } } })
        return
      }
      if (url.pathname.startsWith('/api/reports/')) {
        reportRequests.push({ path:url.pathname, query:url.search })
        if (url.pathname.endsWith('.xlsx')) {
          await route.fulfill({ contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers:{ 'Content-Disposition':'attachment; filename="STI_Vio-Log_Fixture.xlsx"', 'Access-Control-Expose-Headers':'Content-Disposition' }, body:'Synthetic download fixture' })
        } else {
          await route.fulfill({ status:reportMode === 'error' ? 503 : 200, json:reportMode === 'error' ? { message:'Report fixture unavailable.' } : { success:true, generated_at:'2026-10-24T02:00:00Z', data:reportMode === 'empty' ? [] : [{ ...student, ...violation, ...assignment }] } })
        }
        return
      }
      let response = url.pathname === '/api/auth/session' ? { user, csrf_token: 'local-browser-fixture' } : payload
      let status = url.pathname === '/api/auth/session' && !user ? 401 : 200
      if (url.pathname === '/api/account/avatar') response = { avatar:{ source:'INITIALS', preset_id:'portrait-01' } }
      if (url.pathname === '/api/account/admin-profile') response = { profile:{ ...student, username:'fixture.admin', email_verified:false } }
      if (url.pathname === '/api/auth/legal') response = { legal: { required: false } }
      if (url.pathname === '/api/system/status') response = { system: { application: 'STI Vio-Log', environment: 'Production', version: 'layout-fixture', status: 'OPERATIONAL', database: 'CONNECTED', checked_at: '2026-10-23T12:00:00Z', components: {
        api: { status: 'OPERATIONAL' }, database: { status: 'OPERATIONAL', latency_ms: 96 },
        google_identity: { status: 'CONFIGURED' }, email_delivery: { status: 'CONFIGURED' }, realtime: { status: 'AVAILABLE' },
      } } }
      if (degraded && url.pathname === '/api/system/status') {
        response.system.status = 'DEGRADED'
        response.system.database = 'UNAVAILABLE'
        response.system.components.database = { status: 'UNAVAILABLE', remediation: 'Database connectivity is unavailable. Contact the responsible administrator and retry after the connection is restored.' }
      }
      if (url.pathname === '/api/clearance/certificates/students') {
        response = rejectDirectory ? { message: 'Unable to load clearance records.' } : { students: [...clearanceStudents, clearanceStudents[0]].filter(Boolean) }
        status = rejectDirectory ? 503 : 200
      }
      if (url.pathname === '/api/clearance/signatures') response = { signatures: [signature] }
      if (url.pathname === '/api/clearance/certificates') response = { certificates: clearanceCertificates }
      if (/\/api\/clearance\/certificates\/students\/\d+\/approve$/.test(url.pathname)) {
        approvalBodies.push(route.request().postDataJSON())
        if (rejectApproval) { status = 409; response = { message: 'Student requirements changed. Refresh and review again.' } }
        else {
          const id = Number(url.pathname.split('/').at(-2))
          clearanceStudents = clearanceStudents.map((entry) => entry.id === id ? { ...entry, qualification_status: 'QUALIFIED', qualification_reason: 'Ready for certificate issuance.', certificate_eligible: true } : entry)
          response = { success: true }
        }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(response) })
    } else if (url.origin === new URL(origin).origin) await route.continue()
    else await route.abort()
  })
  await page.addInitScript(() => localStorage.removeItem('sti_vio_log_sidebar_collapsed'))
  await mkdir(output, { recursive: true })
  await page.goto(origin)
  // Protected mutations use the same double-submit cookie as the real session.
  await page.context().addCookies([{ name: 'sti_csrf', value: 'local-browser-fixture', url: origin }])

  async function open(path, navigate = false) {
    if (navigate) {
      await page.evaluate((path) => {
        history.pushState({}, '', path)
        dispatchEvent(new PopStateEvent('popstate'))
      }, path)
    } else {
      await page.evaluate((user) => {
        if (user) localStorage.setItem('sti_vio_log_user', JSON.stringify(user))
        else localStorage.removeItem('sti_vio_log_user')
      }, user)
      await page.goto(`${origin}${path.slice(1)}`)
    }
    await page.locator('.app-shell').waitFor()
    await page.locator('.route-loading, .dashboard-loading').waitFor({ state: 'hidden' })
    await page.locator('.page-content').locator('h1:visible, h2:visible, h3:visible').first().waitFor()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }

  async function settleVisuals() {
    await page.evaluate(async reduced => {
      const animations = document.getAnimations().filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
      if (reduced) {
        for (const animation of animations) { try { animation.finish() } catch { /* Scroll timelines need manual review. */ } }
      } else await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
    }, process.argv.includes('--theme-audit'))
  }

  async function changeTheme(theme) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      const toggle = page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, exact:true }).first()
      if (await toggle.isVisible()) await toggle.click()
      else await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
    }
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme)
    await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transitioning'))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await settleVisuals()
  }

  async function collectThemeAudit(label) {
    await settleVisuals()
    const result = await page.evaluate(auditThemeColors)
    const context = { page:label, route:new URL(page.url()).pathname, theme:await page.locator('html').getAttribute('data-theme') }
    themeFindings.push(...result.findings.map(finding => ({ ...context, ...finding })))
    themeManualReview.push(...result.manualReview.map(finding => ({ ...context, ...finding })))
    themeCoverage.push({ ...context, checked:result.checked })
    await writeFile(`${output}theme-audit${themeAuditSuffix}.json`, JSON.stringify(themeFindings, null, 2))
    await writeFile(`${output}theme-manual-review${themeAuditSuffix}.json`, JSON.stringify(themeManualReview, null, 2))
    await writeFile(`${output}theme-coverage${themeAuditSuffix}.json`, JSON.stringify(themeCoverage, null, 2))
  }

  async function check(label, width, authenticated = true) {
    await settleVisuals()
    const flatFindings = await page.evaluate(() => {
      if (!document.querySelector('.app-shell:is(.admin-portal,.student-portal,.department-portal)')) return []
      const findings = []
      for (const element of document.querySelectorAll('.status-badge,.directory-clearance,.clearance-directory-status,.service-status,.violation-status,.violation-classification,.dashboard-severity,.attendance-indicator-label,.chat-status,.record-standing,.record-case-status')) {
        if (!element.getClientRects().length) continue
        const style = getComputedStyle(element)
        if (style.borderRadius !== '4px' || style.boxShadow !== 'none' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 1) {
          findings.push({ text: element.textContent, radius: style.borderRadius, shadow: style.boxShadow, border: style.borderTopWidth, image: style.backgroundImage })
        }
      }
      for (const element of document.querySelectorAll('.student-summary-card,.student-directory-card,.dashboard-card,.management-metric,.student-section,.department-metrics > article,.app-modal:not(.app-modal--drawer)')) {
        if (!element.getClientRects().length) continue
        const style = getComputedStyle(element)
        if (style.borderRadius !== '10px' || document.documentElement.dataset.theme === 'dark' && style.boxShadow !== 'none') findings.push({ card: element.className, radius: style.borderRadius, shadow: style.boxShadow })
      }
      for (const element of document.querySelectorAll('.student-add-button,.directory-view-button,.theme-toggle,.notification-button,.app-modal-close,.student-directory-select,.department-header-actions button')) {
        if (!element.getClientRects().length) continue
        const style = getComputedStyle(element)
        if (style.borderRadius !== '6px' || style.boxShadow !== 'none') findings.push({ control: element.className, radius: style.borderRadius, shadow: style.boxShadow })
      }
      for (const element of document.querySelectorAll('.login-form > button:not([type="button"],.secondary-button,.danger-button),.topbar .account-avatar:not(:has(img))')) {
        const style = getComputedStyle(element)
        const alpha = style.backgroundColor.match(/[\d.]+/g)?.[3] ?? 1
        if (Number(alpha) < 1 || style.color === style.backgroundColor) findings.push({ control: element.className, background: style.backgroundColor, color: style.color })
      }
      return findings
    })
    assert.deepEqual(flatFindings, [], `${label}: flat portal surfaces`)
    if (await page.locator('.student-directory-table').count()) {
      const cleared = page.locator('.directory-clearance').filter({ hasText: /^Cleared$/ })
      const expectedCleared = payload.students.filter(student => payload.clearanceRecords.some(record => record.student_id === student.id && record.status === 'CLEARED')).length
      assert.equal(await cleared.count(), expectedCleared, `${label}: cleared fixture is displayed`)
      if (expectedCleared) assert.equal(await cleared.first().evaluate((element) => element.classList.contains('clearance-cleared')), false, 'directory badges do not inherit clearance-card borders')
    }
    if (process.argv.includes('--theme-audit')) {
      await collectThemeAudit(label)
    }
    const layout = await page.evaluate(() => {
      const css = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const style = getComputedStyle(element)
        return { font: style.fontFamily, size: style.fontSize, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }
      }
      const visible = (element) => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'
      const fonts = [...document.querySelectorAll('body *')].filter((el) => visible(el) && [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => getComputedStyle(el).fontFamily)
      const header = document.querySelector('.topbar')?.getBoundingClientRect()
      const clipped = header ? [...document.querySelectorAll('.topbar button')].filter(visible).filter((el) => {
        const rect = el.getBoundingClientRect()
        return rect.left < header.left - 1 || rect.right > header.right + 1 || rect.bottom > header.bottom + 1 || rect.width < 44 || rect.height < 44
      }).map((el) => el.getAttribute('aria-label')) : []
      const crowdedHeaders = [...document.querySelectorAll('th')].filter(visible).filter((el) => {
        if (el.closest('thead')?.getBoundingClientRect().width <= 1) return false
        const style = getComputedStyle(el)
        if (style.whiteSpace !== 'nowrap') return false
        const range = document.createRange()
        range.selectNodeContents(el)
        return range.getBoundingClientRect().width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) > el.getBoundingClientRect().width + 1
      }).map((el) => el.textContent)
      return { body: css('body'), sidebar: css('.sidebar'), topbar: css('.topbar'), title: css('.portal-page-header h1, .portal-page-header h2'), nav: css('.sidebar .nav-item'), fonts: [...new Set(fonts)], clipped, crowdedHeaders, overflow: document.documentElement.scrollWidth > innerWidth, text: document.querySelector('.page-content').textContent }
    })
    assert.match(layout.body.font, authenticated ? /^"?Segoe UI/ : /^Arial/, `${label}: body font`)
    assert.equal(layout.body.size, '14px', `${label}: body size`)
    if (authenticated) assert.ok(layout.fonts.every((font) => /^"?(?:Segoe UI|Plus Jakarta Sans)/.test(font)), `${label}: fonts ${layout.fonts}`)
    else {
      const radii = await page.evaluate(() => [document.body, document.documentElement].map((element) => getComputedStyle(element).getPropertyValue('--radius-md').trim()))
      assert.equal(radii[0], radii[1], `${label}: public/setup pages do not inherit portal styling`)
    }
    // Late route animations can start after the first data response renders.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 2000 }).catch(error => {
      throw new Error(`${label}: page overflow after layout settles`, { cause: error })
    })
    assert.deepEqual(layout.clipped, [], `${label}: clipped/small header controls`)
    assert.deepEqual(layout.crowdedHeaders, [], `${label}: overlapping table headings`)
    assert.ok(!layout.text.includes('This page could not finish loading'), `${label}: route error`)
    if (authenticated) {
      assert.equal(layout.topbar.height, width < 768 ? 60 : 64, `${label}: topbar height`)
      if (width >= 768) {
        const collapsed = await page.locator('.app-shell').evaluate(element => element.classList.contains('sidebar-collapsed'))
        assert.equal(layout.sidebar.width, collapsed ? 80 : 232, `${label}: sidebar width`)
        assert.equal(layout.nav.size, '14px', `${label}: navigation text`)
        assert.ok(layout.nav.height >= 44, `${label}: navigation target`)
      }
      if (layout.title) assert.equal(layout.title.size, '24px', `${label}: title size`)
      const contract = await page.evaluate(() => {
        const content = document.querySelector('.page-content').getBoundingClientRect()
        const working = document.querySelector('.page-content > :is(.student-management-page,.portal-dashboard,.system-dashboard,.reports-workspace,.audit-workspace,.student-page,.department-page,.department-officer-page,.active-attendance-page,.certificate-admin)')
        const gutter = parseFloat(getComputedStyle(document.querySelector('.page-content')).paddingLeft)
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length)
        const icons = visible('.stat-card > i,.management-metric > i,.student-summary-card > i,.department-stat-icon')
        return { working: working && { width:working.getBoundingClientRect().width, expected:content.width - 2 * gutter }, icons:icons.map(el => el.getBoundingClientRect().width), summaries:visible('.department-stat').map(el => { const style = getComputedStyle(el); return { minHeight:style.minHeight,padding:parseFloat(style.paddingLeft) } }), forms:visible('.account-password-form,.admin-settings-page .login-form').map(el => el.getBoundingClientRect().width), primaryColors:visible('.student-add-button,.violation-record-button,.messages-new-button,.record-primary-button,.violation-drawer-primary').map(el => getComputedStyle(el).backgroundColor) }
      })
      if (contract.working) assert.ok(Math.abs(contract.working.width - contract.working.expected) < 2, `${label}: working page uses available width ${JSON.stringify(contract.working)}`)
      assert.ok(contract.icons.every(size => Math.abs(size - (width < 768 ? 32 : 36)) < 1), `${label}: summary icon sizes ${contract.icons}`)
      assert.ok(contract.summaries.every(style => style.minHeight === '0px' && style.padding === 12), `${label}: summary density ${JSON.stringify(contract.summaries)}`)
      assert.ok(contract.forms.every(size => size <= 760), `${label}: form width ${contract.forms}`)
      assert.ok(contract.primaryColors.every(color => ['rgb(9, 105, 199)', 'rgb(7, 85, 163)'].includes(color)), `${label}: primary action palette ${contract.primaryColors}`)
    }
    coverage.push({ label, width, authenticated })
  }

  const densityBaseline = process.argv.includes('--density-baseline')
  const responsiveOnly = process.argv.includes('--responsive-only')
  if (responsiveOnly) {
    const widths = [320, 360, 390, 600, 767, 768, 936, 1024, 1199, 1200, 1440, 1920, 2560]
    for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
      user = { ...student, role, department_id: 1, department_name: 'Student Support', onboarding_required: false }
      const routes = APP_ROUTES.filter(route => route.roles.includes(role) && !route.redirectTo && !['/account/password-change', '/student/onboarding'].includes(route.path))
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
        for (const theme of ['light', 'dark']) for (const route of routes) {
          if (![390, 936, 1440].includes(width) && !representativeRoutes.has(route.path)) continue
          await open(route.path)
          await changeTheme(theme)
          const label = `${role} ${route.path} ${theme} ${width}`
          await check(label, width)
          const clippedLabels = await page.locator('.mobile-bottom-nav button span').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent))
          assert.deepEqual(clippedLabels, [], `${label}: readable mobile navigation labels`)
          const background = await page.locator('.app-shell').evaluate(async element => {
            const layer = getComputedStyle(element, '::before')
            const main = getComputedStyle(element.querySelector('.main-panel'))
            const photo = new Image()
            photo.src = layer.backgroundImage.match(/url\("?([^"()]+)"?\)/)?.[1] || ''
            await photo.decode()
            return { image: layer.backgroundImage, position: layer.position, inset: layer.inset, events: layer.pointerEvents, main: main.backgroundColor, content: getComputedStyle(element.querySelector('.page-content')).backgroundColor }
          })
          assert.ok(background.image.includes(theme === 'dark' ? 'sti-global-city-building-night' : 'sti-global-city-building-web'), `${label}: theme campus photo`)
          assert.equal(background.position, 'fixed', `${label}: viewport background`)
          assert.equal(background.inset, '0px', `${label}: full viewport coverage`)
          assert.equal(background.events, 'none', `${label}: non-interactive background`)
          assert.equal(background.main, 'rgba(0, 0, 0, 0)', `${label}: canvas reveals photo`)
          assert.equal(background.content, 'rgba(0, 0, 0, 0)', `${label}: page reveals photo`)
          console.log(`PASS ${label}`)
          if (width >= 768) assert.equal(await page.locator('.app-shell').evaluate(el => el.classList.contains('sidebar-collapsed')), width < 1200, `${label}: default sidebar mode`)
          if ([390, 936, 1440].includes(width) && route.path.endsWith('/dashboard')) {
            await page.screenshot({ path: `${output}${role}-${theme}-${width}-campus.png`, animations: 'disabled' })
          }
        }
      }
    }
    user = { ...student, role: 'DISCIPLINE_ADMIN' }
    await page.setViewportSize({ width: 936, height: 1159 })
    await open('/admin/dashboard')
    await page.getByRole('button', { name: 'Expand Navigation', exact: true }).click()
    for (const width of [937, 1024, 1199, 936]) {
      await page.setViewportSize({ width, height: 900 })
      await check(`Expanded tablet ${width}`, width)
      assert.equal(await page.getByRole('button', { name: 'Collapse Navigation', exact: true }).count(), 1, 'manual tablet expansion survives resizing within its range')
      const records = await page.locator('.recent-violations-card').evaluate(el => {
        const style = getComputedStyle(el)
        return { available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), display: getComputedStyle(el.querySelector('tbody tr')).display }
      })
      assert.equal(records.display, records.available <= 704 ? 'grid' : 'table-row', 'records adapt to 44rem of content width')
    }
    for (const [width, collapsed] of [[1200, false], [1199, true], [767, false], [768, true], [1440, false]]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForFunction(expected => document.querySelector('.app-shell').classList.contains('sidebar-collapsed') === expected, collapsed)
      await check(`Navigation range ${width}`, width)
    }
    for (let width = 320; width <= 1500; width += 37) {
      await page.setViewportSize({ width, height: 900 })
      await check(`Intermediate resize ${width}`, width)
    }
    for (const width of [468, 720, 960]) {
      await page.setViewportSize({ width, height: 540 })
      await check(`200% CSS viewport ${width}`, width)
    }
    await page.setViewportSize({ width: 936, height: 600 })
    await open('/admin/dashboard')
    await page.getByRole('button', { name: /Switch to .* Mode/ }).click()
    const selectedTheme = await page.locator('html').getAttribute('data-theme')
    assert.equal(await page.evaluate(() => localStorage.getItem('sti-vio-log-theme')), selectedTheme, 'theme toggle persists its selection')
    await page.reload()
    await page.locator('.admin-dashboard').waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'), selectedTheme, 'theme survives reload')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    assert.equal(await page.locator('.app-shell').evaluate(el => getComputedStyle(el, '::before').inset), '0px', 'background covers viewport after scrolling')
    for (const media of [{ media: 'print' }, { forcedColors: 'active' }]) {
      await page.emulateMedia(media)
      assert.equal(await page.locator('.app-shell').evaluate(el => getComputedStyle(el, '::before').display), 'none', 'decorative image is disabled for print/forced colors')
      await page.emulateMedia({ media: 'screen', forcedColors: 'none' })
    }
    user = null
    await open('/login')
    assert.equal(await page.locator('.app-shell').evaluate(el => getComputedStyle(el, '::before').content), 'none', 'public pages do not inherit portal background')
    assert.deepEqual(errors, [], 'Responsive browser runtime errors')
    await writeFile(`${output}coverage-responsive.json`, JSON.stringify(coverage, null, 2))
    console.log(`PASS ${coverage.length} responsive portal checks`)
  }
  const densityOnly = densityBaseline || process.argv.includes('--density-only')
  const reportFlows = process.argv.includes('--report-flows')
  if (densityOnly) {
    const phase = densityBaseline ? 'before' : 'after'
    const directory = `${output}density-${phase}/`
    await mkdir(directory, { recursive: true })
    const measurements = []
    const before = densityBaseline ? {} : JSON.parse(await readFile(new URL('./fixtures/portal-density-baseline.json', import.meta.url), 'utf8'))
    for (const width of [390, 1366, 1920]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      for (const [role, path] of [['DISCIPLINE_ADMIN', '/admin/dashboard'], ['DISCIPLINE_ADMIN', '/admin/reports'], ['DEPARTMENT_HEAD', '/department/dashboard'], ['STUDENT', '/student/dashboard']]) {
        user = { ...student, role, department_id: 1, department_name: 'Student Support' }
        await open(path)
        await page.locator(`${path === '/admin/reports' ? '.reports-workspace' : path === '/admin/dashboard' ? '.admin-dashboard' : path === '/department/dashboard' ? '.department-dashboard' : '.student-dashboard'} .portal-page-header`).waitFor()
        await changeTheme(theme)
        await page.evaluate(() => document.fonts.ready)
        const layout = await page.evaluate(() => {
          const box = selector => {
            const element = document.querySelector(selector)
            if (!element) return null
            const { top, bottom, height, left, right } = element.getBoundingClientRect()
            return { top, bottom, height, left, right, padding:getComputedStyle(element).padding }
          }
          return {
            header: box('.portal-page-header'), filters: box('.report-filter-card'),
            records: box('.recent-violations-card, .report-results-card, .department-activity-list, .department-dashboard-grid .table-card, .student-recent-list'),
            attendance: box('.active-session-card, .student-attendance-panel'),
            actions: box('.dashboard-primary-actions, .report-filter-actions'),
            fields: [...document.querySelectorAll('.reports-filter-grid > label')].map(el => el.getBoundingClientRect().bottom),
            overflow: document.documentElement.scrollWidth > innerWidth,
            headerBackground: getComputedStyle(document.querySelector('.portal-page-header')).backgroundColor,
            topbar: box('.topbar'),
          }
        })
        const label = `${path} ${theme} ${width}`
        measurements.push({ label, path, width, theme, ...layout })
        if (!densityBaseline) {
          assert.equal(layout.overflow, false, `${label}: document overflow`)
          assert.equal(layout.topbar.height, width < 768 ? 60 : 64, `${label}: compact shell`)
          assert.equal(layout.headerBackground, 'rgba(0, 0, 0, 0)', `${label}: borderless header`)
          if (width >= 1280 && path === '/admin/dashboard') {
            assert.ok(Math.abs(layout.records.top - layout.attendance.bottom - 16) < 2, `${label}: independent dashboard columns`)
            assert.ok(layout.records.top <= before[label] * .75, `${label}: records start at least 25% earlier`)
          }
          if (width >= 1280 && path === '/admin/reports') {
            assert.ok(layout.actions.top < Math.max(...layout.fields), `${label}: actions share the filter grid`)
            assert.ok(layout.records.top <= before[label] * .75, `${label}: report begins at least 25% earlier`)
          }
          if (path === '/student/dashboard') assert.ok(layout.attendance.height <= 74, `${label}: inactive attendance strip ${JSON.stringify(layout.attendance)}`)
        }
        await page.screenshot({ path: `${directory}${path.slice(1).replaceAll('/', '-')}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    await writeFile(`${directory}measurements.json`, JSON.stringify(measurements, null, 2))
    console.log(`PASS ${measurements.length} ${phase} density captures and measurements`)
  }

  if (reportFlows) {
    user = { ...student, role:'DISCIPLINE_ADMIN' }
    for (const width of [390, 1366]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height:900 })
      await open('/admin/reports')
      await page.locator('.reports-workspace').waitFor()
      await changeTheme(theme)
      for (const type of ['violations', 'community-service', 'dtr', 'non-compliance', 'parent-contacts', 'clearance', 'good-standing']) {
        await page.getByRole('combobox', { name:'Report Type', exact:true }).selectOption(type)
        await page.getByRole('button', { name:'Generate Report', exact:true }).click()
        await page.locator('.report-record-table tbody tr').waitFor()
        assert.equal(await page.locator('.report-record-table tbody tr').count(), 1)
        const generated = reportRequests.at(-1)
        if (type === 'violations') {
          await page.getByRole('searchbox', { name:'Search', exact:true }).fill('Changed draft')
          await page.getByText('Filters changed. Generate again to update results.').waitFor()
        }
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name:'Export Excel', exact:true }).click()
        assert.equal((await download).suggestedFilename(), 'STI_Vio-Log_Fixture.xlsx')
        assert.equal(reportRequests.at(-1).path, `/api/reports/${type}.xlsx`)
        assert.equal(reportRequests.at(-1).query, generated.query, 'export uses generated filters, including after a draft edit')
        await check(`Report ${type} ${theme} ${width}`, width)
      }
      await page.getByRole('button', { name:'Clear', exact:true }).click()
      assert.equal(await page.getByRole('button', { name:'Export Excel', exact:true }).isDisabled(), true)
      reportMode = 'empty'
      await page.getByRole('button', { name:'Generate Report', exact:true }).click()
      await page.getByText('No records match these filters. Try another selection.').waitFor()
      assert.equal(await page.getByRole('button', { name:'Export Excel', exact:true }).isDisabled(), true)
      reportMode = 'error'
      await page.getByRole('button', { name:'Generate Report', exact:true }).click()
      await page.getByRole('button', { name:'Retry Report', exact:true }).waitFor()
      reportMode = 'populated'
      await page.getByRole('button', { name:'Retry Report', exact:true }).click()
      await page.locator('.report-record-table tbody tr').waitFor()
      console.log(`PASS all seven reports: generation, export, applied filters, clear, empty and retry; ${theme} ${width}px`)
    }
    assert.deepEqual(errors, [], 'Report browser runtime errors')
  }

  if (messageFlow) {
    for (const role of ['DISCIPLINE_ADMIN', 'STUDENT']) for (const width of [390,1366]) for (const theme of ['light','dark']) {
      user = { ...student, role }
      threadMessages = [{ id:1, message_text:'Please confirm your service schedule.', sender_name:'Discipline Office', created_at:'2026-10-24T01:00:00Z' }]
      await page.setViewportSize({ width,height:900 })
      await open(`${role === 'STUDENT' ? '/student' : '/admin'}/messages`)
      await changeTheme(theme)
      await page.locator('.conversation-open').first().click()
      await page.getByText('Please confirm your service schedule.', { exact:true }).waitFor()
      const composer = page.getByRole('textbox', { name:/^Message/ })
      await composer.fill('Confirmed. Thank you.')
      const send = page.getByRole('button', { name:'Send', exact:true })
      const bounds = await send.boundingBox()
      assert.ok(bounds.width >= 44 && bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= 900, 'composer action remains visible and touch accessible')
      await composer.press('Enter')
      await page.locator('.message-bubble p').filter({ hasText:'Confirmed. Thank you.' }).waitFor()
      assert.equal(await composer.inputValue(), '')
      assert.equal(threadMessages.at(-1).message_text, 'Confirmed. Thank you.')
      await check(`Messages ${role} ${theme} ${width}`, width)
      if (width < 768) {
        await page.getByRole('button', { name:'Back to Conversations', exact:true }).click()
        await page.getByRole('button', { name:'New Message', exact:true }).waitFor()
      }
      console.log(`PASS conversation, visible composer, Enter to send, and mobile Back; ${role} ${theme} ${width}px`)
    }
    assert.deepEqual(errors, [], 'Message browser runtime errors')
  }

  if (!densityOnly && !reportFlows && !messageFlow && !responsiveOnly) {
  // Every role's routes, fresh loads and SPA navigation, in both themes/sizes.
  for (const role of process.argv.includes('--flows-only') ? [] : ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    user = { ...student, role, department_id: 1, department_name: 'Student Support', onboarding_required: false }
    const routes = APP_ROUTES.filter((route) => route.roles.includes(role) && !route.redirectTo && !['/account/password-change', '/student/onboarding'].includes(route.path))
    for (const [width, height] of (process.argv.includes('--theme-audit') ? [390,768,1440,320,683,1920] : [390,768,1440,320,360,430,600,1024,1280,1366,1920]).map(width => [width, width < 768 ? 844 : 900])) {
      await page.setViewportSize({ width, height })
      for (const theme of ['light', 'dark']) {
        for (const [index, route] of routes.entries()) {
          if (![390, 768, 1440].includes(width) && !representativeRoutes.has(route.path)) continue
          await open(route.path, index !== 0)
          await changeTheme(theme)
          await check(`${role} ${route.path} ${theme} ${width}`, width)
          if (process.argv.includes('--theme-audit')) console.log(`AUDIT ${role} ${route.path} ${theme} ${width}`)
          if (process.argv.includes('--theme-audit') && [390,1440].includes(width)) {
            for (const summary of await page.locator('.settings-disclosure > summary').all()) {
              await summary.click()
              await collectThemeAudit(`${role} ${route.path} expanded ${await summary.locator('strong').innerText()} ${theme} ${width}`)
            }
            const controls = page.locator('.portal-page-header button:not(:disabled),.settings-disclosure > summary,.table-card input:not(:disabled),.conversation-actions-trigger').filter({ visible:true })
            for (const control of (await controls.all()).slice(0, 3)) {
              await control.hover()
              await settleVisuals()
              await collectThemeAudit(`${role} ${route.path} hover ${theme} ${width}`)
              await page.keyboard.press('Tab')
              await control.focus()
              await collectThemeAudit(`${role} ${route.path} focus ${theme} ${width}`)
            }
            await changeTheme(theme === 'light' ? 'dark' : 'light')
            await collectThemeAudit(`${role} ${route.path} switched ${width}`)
            await changeTheme(theme)
            await collectThemeAudit(`${role} ${route.path} restored ${width}`)
          }
          if ([1920, 390].includes(width) && ['/admin/dashboard', '/admin/students', '/admin/violations', '/admin/active-attendance', '/admin/community-service', '/admin/clearance', '/admin/messages', '/department/dashboard', '/student/dashboard'].includes(route.path)) {
            await page.screenshot({ path: `${output}${route.path.slice(1).replaceAll('/', '-')}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
          }
          if (route.path === '/admin/students') {
            const program = page.getByRole('combobox', { name: 'Program', exact: true })
            await program.focus()
            await page.keyboard.press('Enter')
            assert.equal(await program.evaluate((element) => {
              const style = getComputedStyle(element)
              return element.matches(':focus-visible') && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2
            }), true, 'flat controls retain a visible keyboard focus ring')
            for (const menu of [page.getByRole('listbox'), page.locator('.student-account-menu')]) {
              if (await menu.count() === 0) {
                const trigger = page.getByRole('button', { name: /^More Actions for/ }).first()
                await trigger.scrollIntoViewIfNeeded()
                await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
                await trigger.click()
              }
              const menuStyle = await menu.evaluate((element) => {
                const style = getComputedStyle(element)
                return { radius: style.borderRadius, shadow: style.boxShadow, outsideShell: !element.closest('.app-shell') }
              })
              assert.equal(menuStyle.radius, '10px', 'body-mounted menus share the portal surface')
              assert.equal(menuStyle.outsideShell, true)
              if (theme === 'dark') assert.equal(menuStyle.shadow, 'none')
              await page.keyboard.press('Escape')
            }
            await page.locator('.student-summary-card').first().hover()
            assert.equal(await page.locator('.student-summary-card').first().evaluate((element) => getComputedStyle(element).transform), 'none', 'summary cards stay flat on hover')
          }
        }
        await page.screenshot({ path: `${output}${role}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    console.log(`PASS ${role}: ${routes.length} routes at 390/768/1440px; representative routes at eight additional widths; light/dark`)
  }

  // Stress the shared patterns with real-length content and truthful failure states.
  for (const width of [1920, 320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      for (const [role, path] of [['DISCIPLINE_ADMIN', '/admin/departments-officers'], ['DISCIPLINE_OFFICE', '/admin/account-settings'], ['DEPARTMENT_HEAD', '/department/account-settings'], ['DEPARTMENT_HEAD', '/department/dashboard'], ['DEPARTMENT_HEAD', '/department/students'], ['DEPARTMENT_HEAD', '/department/community-service'], ['DISCIPLINE_ADMIN', '/admin/handbook'], ['DISCIPLINE_ADMIN', '/admin/dashboard'], ['STUDENT', '/student/dashboard']]) {
        user = { ...student, role, department_id: 1, department_name: 'Student Support' }
        await open(path)
        await changeTheme(theme)
        await check(`Shared patterns ${path} ${theme} ${width}`, width)
        if (process.argv.includes('--theme-audit') && ['/department/community-service','/department/students'].includes(path)) {
          await page.locator('.department-welcome > button').hover()
          await collectThemeAudit(`Department header ${path} hover ${theme} ${width}`)
          await page.locator('.department-welcome > button').focus()
          await collectThemeAudit(`Department header ${path} focus ${theme} ${width}`)
        }
        if (process.argv.includes('--theme-audit') && path === '/student/dashboard') {
          await changeTheme(theme === 'light' ? 'dark' : 'light')
          await collectThemeAudit(`Student metadata switched ${width}`)
          await changeTheme(theme)
          await collectThemeAudit(`Student metadata restored ${width}`)
        }
        const severity = page.locator('.dashboard-severity.severity-minor')
        if (await severity.count()) assert.equal(await severity.first().evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(255, 216, 112)' : 'rgb(128, 96, 0)', 'minor severity uses the same palette in both record views')
      }
      user = { ...student, role: 'DISCIPLINE_ADMIN' }
      const originalStudents = payload.students
      payload.students = [{ ...student, first_name: 'Maria Alessandra Christina', last_name: 'Dela Cruz Villanueva-Santos', student_number: '0200000123456789', program: 'Bachelor of Science in Information Technology', section: 'INFORMATION-TECHNOLOGY-A303' }]
      await open('/admin/students')
      await changeTheme(theme)
      await page.getByText('Maria Alessandra Christina Dela Cruz Villanueva-Santos', { exact: true }).waitFor()
      await check(`Long student content ${theme} ${width}`, width)
      payload.students = []
      await open('/admin/students')
      await changeTheme(theme)
      await page.getByText('No student records yet.', { exact: true }).waitFor()
      await check(`Empty student directory ${theme} ${width}`, width)
      payload.students = originalStudents
      degraded = true
      await open('/admin/system-monitoring')
      await changeTheme(theme)
      await page.getByText('Degraded', { exact: true }).waitFor()
      await check(`Degraded monitoring ${theme} ${width}`, width)
      assert.equal(await page.locator('.component-health-card--database .status-badge').textContent(), 'Unavailable')
      assert.equal(await page.locator('.component-health-card--database .status-badge').evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(255, 155, 167)' : 'rgb(165, 35, 54)')
      await page.screenshot({ path: `${output}monitoring-degraded-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      degraded = false
    }
  }
  console.log('PASS shared summaries, bounded password forms, severity colors, long/empty records, and degraded monitoring at 320/768/1440/1920px in both themes.')

  user = { ...student, role: 'DISCIPLINE_ADMIN' }
  for (const width of [1920, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      clearanceStudents = structuredClone(clearanceFixtures)
      await open('/admin/awaiting-clearance?panel=history')
      await changeTheme(theme)
      await page.locator('.certificate-student-list[aria-busy="false"]').waitFor()
      assert.equal(await page.locator('.certificate-student-card').count(), 2, 'queue excludes blocked, incomplete, unassigned and approved students; duplicate students removed')
      assert.equal(await page.getByRole('tab').count(), 0, 'queue remains its own page despite a legacy panel query')
      await page.locator('.certificate-admin').getByRole('searchbox', { name: 'Search Students', exact: true }).fill('garcia')
      assert.equal(await page.locator('.certificate-student-card').count(), 1)
      await page.locator('.certificate-admin').getByRole('searchbox', { name: 'Search Students', exact: true }).fill('')
      await check(`Awaiting Clearance ${theme} ${width}`, width)
      await page.screenshot({ path: `${output}awaiting-clearance-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.locator('.certificate-student-card').filter({ hasText: 'Maria Santos' }).getByRole('button', { name: 'Approve Clearance', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await check(`Clearance approval dialog ${theme} ${width}`, width)
      await page.getByRole('dialog').getByRole('button', { name: 'Approve Clearance', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.locator('.certificate-student-list[aria-busy="false"]').waitFor()
      assert.equal(await page.locator('.certificate-student-card').count(), 1, 'approved student leaves queue immediately')
      assert.equal(await page.locator('[name="clearance-student-filter"]').evaluate((el) => document.activeElement === el), true, 'approval restores keyboard focus to search')
      assert.deepEqual(approvalBodies.at(-1), {}, 'existing clearance uses its own term')
      await page.getByRole('button', { name: 'Approve Clearance', exact: true }).click()
      const dialog = page.getByRole('dialog')
      assert.equal(await dialog.getByRole('button', { name: 'Approve Clearance', exact: true }).isDisabled(), true)
      await dialog.getByLabel('Academic year').fill('2026-2027')
      rejectApproval = true
      await dialog.getByRole('button', { name: 'Approve Clearance', exact: true }).click()
      await dialog.getByRole('alert').waitFor()
      await check(`Clearance approval error ${theme} ${width}`, width)
      assert.equal(await page.locator('.certificate-student-card').count(), 1, 'failed approval does not remove student')
      rejectApproval = false
      await dialog.getByRole('button', { name: 'Approve Clearance', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByText('No Students Awaiting Clearance', { exact: true }).waitFor()
      assert.deepEqual(approvalBodies.at(-1), { academic_year: '2026-2027', semester: '1st Semester' })
      await page.getByRole('button', { name: 'Back to Clearance Management' }).click()
      await page.locator('.certificate-student-list[aria-busy="false"]').waitFor()
      assert.equal(new URL(page.url()).pathname, '/admin/clearance')
      assert.equal(await page.locator('.certificate-student-card').count(), 7)
      await check(`Clearance directory ${theme} ${width}`, width)
      await page.screenshot({ path: `${output}clearance-directory-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.locator('.certificate-student-card').filter({ hasText: 'Rafael Cruz' }).getByRole('button', { name: 'Review & Issue Certificate' }).click()
      await page.getByRole('dialog').waitFor()
      await check(`Certificate review drawer ${theme} ${width}`, width)
      assert.equal(await page.getByRole('button', { name: 'Issue, Email & Prepare PDF' }).isDisabled(), true, 'issuance requires an authorized signature')
      await page.keyboard.press('Escape')
      await page.getByRole('tab', { name: 'E-Signature Management' }).click()
      assert.equal(new URL(page.url()).searchParams.get('panel'), 'signatures')
      await check(`Clearance signatures ${theme} ${width}`, width)
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await check(`Signature edit dialog ${theme} ${width}`, width)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await check(`Signature deactivate dialog ${theme} ${width}`, width)
      await page.keyboard.press('Escape')
      await page.getByRole('tab', { name: 'Certificate History' }).click()
      await check(`Clearance history ${theme} ${width}`, width)
      await page.getByRole('button', { name: 'Revoke', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      await check(`Certificate revoke dialog ${theme} ${width}`, width)
      await page.keyboard.press('Escape')
      await page.goBack()
      await page.getByRole('tab', { name: 'E-Signature Management', selected: true }).waitFor()
      console.log(`PASS clearance: queue, approvals, errors, issuance, signature dialogs, history, Back navigation; ${theme} ${width}px`)
    }
  }
  rejectDirectory = true
  await open('/admin/awaiting-clearance')
  await page.getByRole('button', { name: 'Try Again' }).waitFor()
  rejectDirectory = false
  await page.getByRole('button', { name: 'Try Again' }).click()
  await page.getByText('No Students Awaiting Clearance', { exact: true }).waitFor()
  await page.setViewportSize({ width: 1366, height: 768 })
  for (const path of ['/admin/students', '/admin/community-service', '/admin/qr-scan', '/admin/messages', '/admin/dashboard', '/admin/students']) {
    await open(path)
    await check(`fresh ${path}`, 1366)
    await page.screenshot({ path: `${output}${path.split('/').at(-1)}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Collapse navigation' }).click()
  assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width), 80)
  await page.getByRole('button', { name: 'Expand navigation' }).click()
  await page.locator('.sidebar .nav-item').first().focus()
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('.sidebar :focus-visible').evaluate((element) => getComputedStyle(element).outlineColor), 'rgb(255, 255, 255)', 'sidebar focus remains visible against navy')
  await page.getByRole('button', { name: /^View Student / }).first().click()
  await page.getByRole('dialog').waitFor()
  assert.match(await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).fontFamily), /^"?Segoe UI/)
  await page.screenshot({ path: `${output}student-drawer.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.locator('.app-modal-header h2').evaluate((el) => getComputedStyle(el).fontSize), '18px')
  await page.keyboard.press('Escape')

  // Zoom changes the effective CSS viewport; cover 125% and 200% equivalents.
  for (const zoom of [1.25, 2]) {
    const width = Math.round(1366 / zoom)
    await page.setViewportSize({ width, height: Math.round(768 / zoom) })
    await open('/admin/students')
    await check(`Students ${zoom * 100}% zoom equivalent`, width)
  }

  user = null
  for (const width of [320, 360, 390, 430, 600, 768, 1024, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PUBLIC_ROUTES) {
      await open(path)
      for (const theme of ['light', 'dark']) {
        await changeTheme(theme)
        await check(`${path} ${theme} ${width}`, width, false)
      if (process.argv.includes('--theme-audit')) {
        for (const control of (await page.locator('.public-policy-brand,.auth-shell input:not(:disabled),.auth-theme-toggle').filter({visible:true}).all()).slice(0,3)) {
          await control.hover()
          await settleVisuals()
          await collectThemeAudit(`${path} public hover ${theme} ${width}`)
          await control.focus()
          await collectThemeAudit(`${path} public focus ${theme} ${width}`)
        }
      }
        if (path === '/login') await page.screenshot({ path: `${output}login-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
  }
  for (const width of [320, 390, 768, 1440]) for (const flag of ['onboarding_required', 'password_change_required']) {
    await page.setViewportSize({ width, height: 900 })
    user = { ...student, role: 'STUDENT', [flag]: true }
    await open(flag === 'onboarding_required' ? '/student/onboarding' : '/account/password-change')
    for (const theme of ['light', 'dark']) {
      await changeTheme(theme)
      await check(`${flag} ${theme} ${width}`, width, false)
    }
  }
  await writeFile(`${output}${process.argv.includes('--flows-only') ? 'coverage-flows' : 'coverage-routes'}.json`, JSON.stringify(coverage, null, 2))
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('PASS fresh loads, collapse/expand, dialogs, zoom layouts, public/authentication flows.')
  }
  if (process.argv.includes('--theme-audit')) {
    await writeFile(`${output}theme-audit${themeAuditSuffix}.json`, JSON.stringify(themeFindings, null, 2))
    const unique = [...new Map(themeFindings.map((finding) => [`${finding.selector}:${finding.issue}:${finding.color || finding.background}`, finding])).values()]
    console.log(JSON.stringify(unique.slice(0, 40), null, 2))
    assert.equal(unique.length, 0, `Light/dark themes: ${unique.length} distinct color leaks/contrast failures; see artifacts/ui-consistency/theme-audit.json`)
  }
} catch (error) {
  await page?.screenshot({ path: `${output}failure.png`, fullPage: true, animations: 'disabled' }).catch(() => {})
  throw error
} finally {
  await browser?.close()
  await server.close()
}
