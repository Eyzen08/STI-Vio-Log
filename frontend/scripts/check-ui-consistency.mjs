// Run with Playwright available locally or through NODE_PATH (no app dependency).
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { APP_ROUTES, PUBLIC_ROUTES } from '../src/lib/routes.js'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../artifacts/ui-consistency/', import.meta.url))
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
const server = await createServer({ root, cacheDir: `${output}vite-cache`, server: { host: '127.0.0.1', port: 0, hmr: false } })
let browser, page
let user
const errors = []
const themeFindings = []
const coverage = []
let degraded = false
const representativeRoutes = new Set(['/admin/dashboard', '/admin/students', '/admin/system-monitoring', '/admin/messages', '/admin/qr-scan', '/admin/account-settings', '/department/dashboard', '/department/students', '/department/dtr', '/department/qr-scan', '/student/dashboard', '/student/profile', '/student/community-service', '/student/clearance', '/student/messages'])

try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  page = await browser.newPage({ bypassCSP: true })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      let response = url.pathname === '/api/auth/session' ? { user, csrf_token: 'local-browser-fixture' } : payload
      let status = url.pathname === '/api/auth/session' && !user ? 401 : 200
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

  async function check(label, width, authenticated = true) {
    await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation instanceof CSSTransition).map((animation) => animation.finished.catch(() => {}))))
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
        if (style.borderRadius !== '12px' || document.documentElement.dataset.theme === 'dark' && style.boxShadow !== 'none') findings.push({ card: element.className, radius: style.borderRadius, shadow: style.boxShadow })
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
      const findings = await page.evaluate(() => {
        if (document.documentElement.dataset.theme !== 'dark') return []
        const rgb = (color) => color.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]
        const luminance = (channels) => channels.slice(0, 3).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
        const findings = []
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          if (!el.getClientRects().length || rect.width < 2 || rect.height < 2 || style.visibility !== 'visible' || Number(style.opacity) === 0 || el.closest('[aria-hidden="true"],svg,script,style,.sr-only')) continue
          const ownBackground = rgb(style.backgroundColor)
          const selector = `${el.parentElement?.className || el.parentElement?.tagName} > ${el.tagName.toLowerCase()}.${String(el.className).trim().replaceAll(' ', '.')}`
          const paper = el.closest('.certificate-preview,.clearance-certificate,.qr-mini,.qr-display-card canvas,.qr-display-card img,.signature-directory img,.signature-form > img,.signature-preview-grid img,.signature-picker img,.handbook-reader')
          if (!paper && (ownBackground[3] ?? 1) >= .9 && luminance(ownBackground) > .65 && rect.width * rect.height > 150) findings.push({ selector, issue: 'light surface', background: style.backgroundColor })
          const text = [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent.trim()).join(' ')
          if (!text || el.matches('progress') || el.closest(':disabled,[disabled]')) continue
          const layers = []
          let layeredImage = false
          for (let current = el; current; current = current.parentElement) {
            const currentStyle = getComputedStyle(current)
            const background = rgb(currentStyle.backgroundColor)
            if (currentStyle.backgroundImage !== 'none') { layeredImage = true; break }
            layers.push(background)
            if ((background[3] ?? 1) === 1) break
          }
          if (layeredImage) continue
          const composite = layers.reverse().reduce((base, color) => base.map((v, i) => color[i] * (color[3] ?? 1) + v * (1 - (color[3] ?? 1))), [255, 255, 255])
          const foreground = rgb(style.color)
          const textColor = composite.map((v, i) => foreground[i] * (foreground[3] ?? 1) + v * (1 - (foreground[3] ?? 1)))
          const values = [luminance(textColor), luminance(composite)].sort((a, b) => b - a)
          const ratio = (values[0] + .05) / (values[1] + .05)
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
          if (ratio < (large ? 3 : 4.5)) findings.push({ selector, issue: 'text contrast', text: text.slice(0, 70), ratio: Number(ratio.toFixed(2)), color: style.color, background: composite.map(Math.round) })
        }
        return findings
      })
      themeFindings.push(...findings.map((finding) => ({ page: label, ...finding })))
      await writeFile(`${output}theme-audit.json`, JSON.stringify(themeFindings, null, 2))
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
    assert.match(layout.body.font, /^Arial/, `${label}: body font`)
    assert.equal(layout.body.size, '14px', `${label}: body size`)
    if (authenticated) assert.ok(layout.fonts.every((font) => /^Arial/.test(font)), `${label}: fonts ${layout.fonts}`)
    else {
      const radii = await page.evaluate(() => [document.body, document.documentElement].map((element) => getComputedStyle(element).getPropertyValue('--radius-md').trim()))
      assert.equal(radii[0], radii[1], `${label}: public/setup pages do not inherit portal styling`)
    }
    assert.equal(layout.overflow, false, `${label}: page overflow`)
    assert.deepEqual(layout.clipped, [], `${label}: clipped/small header controls`)
    assert.deepEqual(layout.crowdedHeaders, [], `${label}: overlapping table headings`)
    assert.ok(!layout.text.includes('This page could not finish loading'), `${label}: route error`)
    if (authenticated) {
      assert.equal(layout.topbar.height, width < 768 ? 60 : 75, `${label}: topbar height`)
      if (width >= 768) {
        assert.equal(layout.sidebar.width, 248, `${label}: sidebar width`)
        assert.equal(layout.nav.size, '14px', `${label}: navigation text`)
        assert.ok(layout.nav.height >= 44, `${label}: navigation target`)
      }
      if (layout.title) assert.equal(layout.title.size, `${width < 768 ? 24 : 28}px`, `${label}: title size`)
      const contract = await page.evaluate(() => {
        const content = document.querySelector('.page-content').getBoundingClientRect()
        const working = document.querySelector('.page-content > :is(.student-management-page,.portal-dashboard,.system-dashboard,.reports-workspace,.audit-workspace,.student-page,.department-page,.department-officer-page,.active-attendance-page,.certificate-admin)')
        const gutter = parseFloat(getComputedStyle(document.querySelector('.page-content')).paddingLeft)
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length)
        const icons = visible('.stat-card > i,.management-metric > i,.student-summary-card > i,.department-stat-icon')
        return { working: working && { width:working.getBoundingClientRect().width, expected:content.width - 2 * gutter }, icons:icons.map(el => el.getBoundingClientRect().width), summaries:visible('.department-stat').map(el => { const style = getComputedStyle(el); return { minHeight:style.minHeight,padding:parseFloat(style.paddingLeft) } }), forms:visible('.account-password-form,.admin-settings-page .login-form').map(el => el.getBoundingClientRect().width), primaryColors:visible('.student-add-button,.violation-record-button,.messages-new-button,.record-primary-button,.violation-drawer-primary').map(el => getComputedStyle(el).backgroundColor) }
      })
      if (contract.working) assert.ok(Math.abs(contract.working.width - contract.working.expected) < 2, `${label}: working page uses available width ${JSON.stringify(contract.working)}`)
      assert.ok(contract.icons.every(size => Math.abs(size - (width < 768 ? 36 : 44)) < 1), `${label}: summary icon sizes ${contract.icons}`)
      assert.ok(contract.summaries.every(style => style.minHeight === '0px' && style.padding === (width < 768 ? 12 : 16)), `${label}: summary density ${JSON.stringify(contract.summaries)}`)
      assert.ok(contract.forms.every(size => size <= 760), `${label}: form width ${contract.forms}`)
      assert.ok(contract.primaryColors.every(color => ['rgb(9, 105, 199)', 'rgb(7, 85, 163)'].includes(color)), `${label}: primary action palette ${contract.primaryColors}`)
    }
    coverage.push({ label, width, authenticated })
  }

  // Every role's routes, fresh loads and SPA navigation, in both themes/sizes.
  for (const role of process.argv.includes('--flows-only') ? [] : ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    user = { ...student, role, department_id: 1, department_name: 'Student Support', onboarding_required: false }
    const routes = APP_ROUTES.filter((route) => route.roles.includes(role) && !route.redirectTo && !['/account/password-change', '/student/onboarding'].includes(route.path))
    for (const [width, height] of [390, 768, 1440, 320, 360, 430, 600, 1024, 1280, 1366, 1920].map(width => [width, width < 768 ? 844 : 900])) {
      await page.setViewportSize({ width, height })
      for (const theme of ['light', 'dark']) {
        for (const [index, route] of routes.entries()) {
          if (![390, 768, 1440].includes(width) && !representativeRoutes.has(route.path)) continue
          await open(route.path, index !== 0)
          await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
          await check(`${role} ${route.path} ${theme} ${width}`, width)
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
              assert.equal(menuStyle.radius, '12px', 'body-mounted menus share the portal surface')
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
      for (const [role, path] of [['DISCIPLINE_ADMIN', '/admin/departments-officers'], ['DISCIPLINE_OFFICE', '/admin/account-settings'], ['DEPARTMENT_HEAD', '/department/account-settings'], ['DEPARTMENT_HEAD', '/department/dashboard'], ['DEPARTMENT_HEAD', '/department/community-service'], ['DISCIPLINE_ADMIN', '/admin/handbook'], ['DISCIPLINE_ADMIN', '/admin/dashboard']]) {
        user = { ...student, role, department_id: 1, department_name: 'Student Support' }
        await open(path)
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        await check(`Shared patterns ${path} ${theme} ${width}`, width)
        const severity = page.locator('.dashboard-severity.severity-minor')
        if (await severity.count()) assert.equal(await severity.first().evaluate(el => getComputedStyle(el).color), theme === 'dark' ? 'rgb(255, 216, 112)' : 'rgb(128, 96, 0)', 'minor severity uses the same palette in both record views')
      }
      user = { ...student, role: 'DISCIPLINE_ADMIN' }
      const originalStudents = payload.students
      payload.students = [{ ...student, first_name: 'Maria Alessandra Christina', last_name: 'Dela Cruz Villanueva-Santos', student_number: '0200000123456789', program: 'Bachelor of Science in Information Technology', section: 'INFORMATION-TECHNOLOGY-A303' }]
      await open('/admin/students')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      await page.getByText('Maria Alessandra Christina Dela Cruz Villanueva-Santos', { exact: true }).waitFor()
      await check(`Long student content ${theme} ${width}`, width)
      payload.students = []
      await open('/admin/students')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      await page.getByText('No student records yet.', { exact: true }).waitFor()
      await check(`Empty student directory ${theme} ${width}`, width)
      payload.students = originalStudents
      degraded = true
      await open('/admin/system-monitoring')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
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
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
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
  assert.match(await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).fontFamily), /^Arial/)
  await page.screenshot({ path: `${output}student-drawer.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.locator('.app-modal-header h2').evaluate((el) => getComputedStyle(el).fontSize), '20px')
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
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        await check(`${path} ${theme} ${width}`, width, false)
        if (path === '/login') await page.screenshot({ path: `${output}login-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
  }
  for (const width of [320, 390, 768, 1440]) for (const flag of ['onboarding_required', 'password_change_required']) {
    await page.setViewportSize({ width, height: 900 })
    user = { ...student, role: 'STUDENT', [flag]: true }
    await open(flag === 'onboarding_required' ? '/student/onboarding' : '/account/password-change')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      await check(`${flag} ${theme} ${width}`, width, false)
    }
  }
  await writeFile(`${output}${process.argv.includes('--flows-only') ? 'coverage-flows' : 'coverage-routes'}.json`, JSON.stringify(coverage, null, 2))
  assert.deepEqual(errors, [], 'Browser runtime errors')
  if (process.argv.includes('--theme-audit')) {
    await writeFile(`${output}theme-audit.json`, JSON.stringify(themeFindings, null, 2))
    const unique = [...new Map(themeFindings.map((finding) => [`${finding.selector}:${finding.issue}:${finding.color || finding.background}`, finding])).values()]
    console.log(JSON.stringify(unique.slice(0, 40), null, 2))
    assert.equal(unique.length, 0, `Dark theme: ${unique.length} distinct color leaks/contrast failures; see artifacts/ui-consistency/theme-audit.json`)
  }
  console.log('PASS fresh loads, collapse/expand, dialogs, zoom layouts, public/authentication flows.')
} catch (error) {
  await page?.screenshot({ path: `${output}failure.png`, fullPage: true, animations: 'disabled' }).catch(() => {})
  throw error
} finally {
  await browser?.close()
  await server.close()
}
