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
const payload = { students: [student], student, profile: student, violations: [violation], assignments: [assignment], sessions: [], notifications: [], summary: {}, destinations: [], departments: [], officers: [], accounts: [], records: [], rows: [], entries: [], logs: [], conversations: [], recipients: [], messages: [], violationTypes: [], clearanceRecords: [], corrections: [], results: [], pagination: { page: 1, totalPages: 1, total: 1 } }
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
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
let browser
let user
const errors = []
const themeFindings = []

try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ bypassCSP: true })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      let response = url.pathname === '/api/auth/session' ? { user, csrf_token: 'local-browser-fixture' } : payload
      let status = url.pathname === '/api/auth/session' && !user ? 401 : 200
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
    await page.locator('.page-content').locator('h1, h2, h3').first().waitFor()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }

  async function check(label, width, authenticated = true) {
    await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation instanceof CSSTransition).map((animation) => animation.finished.catch(() => {}))))
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
          const paper = el.closest('.certificate-preview,.clearance-certificate,.qr-mini,.qr-display-card canvas,.qr-display-card img,.signature-directory img,.signature-form > img,.signature-preview-grid img,.signature-picker img')
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
    assert.ok(layout.fonts.every((font) => /^Arial/.test(font)), `${label}: fonts ${layout.fonts}`)
    assert.equal(layout.overflow, false, `${label}: page overflow`)
    assert.deepEqual(layout.clipped, [], `${label}: clipped/small header controls`)
    assert.deepEqual(layout.crowdedHeaders, [], `${label}: overlapping table headings`)
    assert.ok(!layout.text.includes('This page could not finish loading'), `${label}: route error`)
    if (authenticated) {
      assert.equal(layout.topbar.height, width < 768 ? 60 : 75, `${label}: topbar height`)
      if (width >= 768) {
        assert.equal(layout.sidebar.width, 220, `${label}: sidebar width`)
        assert.equal(layout.nav.size, '14px', `${label}: navigation text`)
        assert.ok(layout.nav.height >= 44, `${label}: navigation target`)
      }
      if (layout.title) assert.equal(layout.title.size, label.includes('/admin/system-monitoring') ? '22px' : `${width < 768 ? 26 : width < 1280 ? 28 : 32}px`, `${label}: title size`)
    }
  }

  // Every role's routes, fresh loads and SPA navigation, in both themes/sizes.
  for (const role of process.argv.includes('--flows-only') ? [] : ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    user = { ...student, role, department_id: 1, department_name: 'Student Support', onboarding_required: false }
    const routes = APP_ROUTES.filter((route) => route.roles.includes(role) && !route.redirectTo)
    for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844]]) {
      await page.setViewportSize({ width, height })
      for (const theme of ['light', 'dark']) {
        for (const [index, route] of routes.entries()) {
          await open(route.path, index !== 0)
          await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
          await check(`${role} ${route.path} ${theme} ${width}`, width)
        }
        await page.screenshot({ path: `${output}${role}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    console.log(`PASS ${role}: ${routes.length} routes, desktop/tablet/mobile, light/dark`)
  }

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
      await page.locator('.certificate-admin').getByRole('searchbox', { name: 'Search students', exact: true }).fill('garcia')
      assert.equal(await page.locator('.certificate-student-card').count(), 1)
      await page.locator('.certificate-admin').getByRole('searchbox', { name: 'Search students', exact: true }).fill('')
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
      await page.getByText('No students awaiting clearance', { exact: true }).waitFor()
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
  await page.getByRole('button', { name: 'Try again' }).waitFor()
  rejectDirectory = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByText('No students awaiting clearance', { exact: true }).waitFor()
  await page.setViewportSize({ width: 1366, height: 768 })
  for (const path of ['/admin/students', '/admin/community-service', '/admin/qr-scan', '/admin/messages', '/admin/dashboard', '/admin/students']) {
    await open(path)
    await check(`fresh ${path}`, 1366)
    await page.screenshot({ path: `${output}${path.split('/').at(-1)}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Collapse navigation' }).click()
  assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width), 80)
  await page.getByRole('button', { name: 'Expand navigation' }).click()
  await page.getByRole('button', { name: /^View Student / }).first().click()
  await page.getByRole('dialog').waitFor()
  assert.match(await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).fontFamily), /^Arial/)
  await page.screenshot({ path: `${output}student-drawer.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.locator('.app-modal-header h2').evaluate((el) => getComputedStyle(el).fontSize), '22px')
  await page.keyboard.press('Escape')

  // Zoom changes the effective CSS viewport; cover 125% and 200% equivalents.
  for (const zoom of [1.25, 2]) {
    const width = Math.round(1366 / zoom)
    await page.setViewportSize({ width, height: Math.round(768 / zoom) })
    await open('/admin/students')
    await check(`Students ${zoom * 100}% zoom equivalent`, width)
  }

  user = null
  for (const width of [1920, 390]) {
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
  for (const flag of ['onboarding_required', 'password_change_required']) {
    user = { ...student, role: 'STUDENT', [flag]: true }
    await open(flag === 'onboarding_required' ? '/student/onboarding' : '/account/password-change')
    await check(flag, 390, false)
  }
  assert.deepEqual(errors, [], 'Browser runtime errors')
  if (process.argv.includes('--theme-audit')) {
    await writeFile(`${output}theme-audit.json`, JSON.stringify(themeFindings, null, 2))
    const unique = [...new Map(themeFindings.map((finding) => [`${finding.selector}:${finding.issue}:${finding.color || finding.background}`, finding])).values()]
    console.log(JSON.stringify(unique.slice(0, 40), null, 2))
    assert.equal(unique.length, 0, `Dark theme: ${unique.length} distinct color leaks/contrast failures; see artifacts/ui-consistency/theme-audit.json`)
  }
  console.log('PASS fresh loads, collapse/expand, dialogs, zoom layouts, public/authentication flows.')
} finally {
  await browser?.close()
  await server.close()
}
