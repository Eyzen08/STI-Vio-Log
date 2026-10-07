// Run with Playwright available locally or through NODE_PATH (no app dependency).
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
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
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
let browser
let user
const errors = []

try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ bypassCSP: true })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: url.pathname === '/api/auth/session' && !user ? 401 : 200, contentType: 'application/json', body: JSON.stringify(url.pathname === '/api/auth/session' ? { user } : payload) })
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
      if (layout.title) assert.equal(layout.title.size, `${width < 768 ? 26 : width < 1280 ? 28 : 32}px`, `${label}: title size`)
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
  console.log('PASS fresh loads, collapse/expand, dialogs, zoom layouts, public/authentication flows.')
} finally {
  await browser?.close()
  await server.close()
}
