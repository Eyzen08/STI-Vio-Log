// Run with Playwright available locally or through NODE_PATH; no app dependency needed.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../artifacts/admin-dashboard/', import.meta.url))
const user = { id: 1, role: 'DISCIPLINE_ADMIN', full_name: 'Juan Dela Cruz' }
const students = [
  { id: 1, first_name: 'Maria', last_name: 'Santos', student_number: '2024-001' },
  { id: 2, first_name: 'Rollz-Steven', last_name: 'Maballo Mahilum', student_number: '02000354468' }
]
const violations = ['OPEN', 'IN_PROGRESS', 'COMPLETE', 'CLEAR'].map((status, i) => ({
  id: i + 1, student_id: 2, student_name: 'Rollz-Steven Maballo Mahilum', student_number: '02000354468',
  exact_offense: 'Non-wearing, incomplete, or improper use of school uniform or ID',
  incident_date: '2026-10-05', incident_time: '16:00:00', severity: i ? 'MAJOR' : 'GRAVE',
  status, offense_indicator_level: ['MINOR_1', 'MINOR_2', 'MAJOR_LEVEL', 'GRAVE'][i]
}))
const assignments = students.map((student) => ({ id: student.id, student_id: student.id,
  required_hours: 4, remaining_hours: 2, status: 'IN_PROGRESS' }))
const sessions = [1, 2, 3].map((id) => ({
  id, session_id: id, student_id: id === 3 ? 2 : 1, assignment_id: id, status: 'ACTIVE', time_out: null,
  time_in: new Date(Date.now() - 3600000).toISOString(), timer_limit_seconds: id === 1 ? 30 : 7200,
  department_name: 'Community Engagement and Student Support Department'
}))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
let browser
let scenario = 'populated'
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  // API responses are intercepted; bypass the development origin's CSP for fixtures.
  const page = await browser.newPage({ bypassCSP: true })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      const empty = scenario === 'empty'
      const payloads = {
        '/api/auth/session': { user },
        '/api/students': { students: empty ? [] : students },
        '/api/violations': { violations: empty ? [] : violations },
        '/api/violations/types': { violationTypes: [] },
        '/api/community-service': { assignments: empty ? [] : assignments },
        '/api/community-service/active-sessions': { sessions: empty ? [] : sessions },
        '/api/community-service/assignment-options': { destinations: [] },
        '/api/clearance': { clearanceRecords: [] },
        '/api/notifications': { notifications: [], summary: { unread: 20 } }
      }
      if (scenario === 'loading' && url.pathname !== '/api/auth/session') await new Promise((resolve) => setTimeout(resolve, 1500))
      const failed = scenario === 'error' && url.pathname === '/api/students'
      await route.fulfill({ status: failed ? 500 : 200, contentType: 'application/json',
        body: JSON.stringify(failed ? { message: 'Dashboard data unavailable' } : payloads[url.pathname] || {}) })
    } else if (url.origin === new URL(origin).origin) await route.continue()
    else await route.abort()
  })
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sti_vio_log_user', JSON.stringify(user))
  }, { user })
  await mkdir(output, { recursive: true })
  const viewports = [[1920, 1080], [1536, 864], [1366, 768], [1024, 768], [390, 844]]
  for (const theme of ['light', 'dark']) {
    for (const [width, height] of viewports) {
      for (const zoom of [1, .9, 1.25]) {
        // Browser zoom changes the CSS viewport. Exercise equivalent layout sizes.
        await page.setViewportSize({ width: Math.round(width / zoom), height: Math.round(height / zoom) })
        await page.goto(`${origin}admin/dashboard`)
        await page.locator('.admin-dashboard[aria-busy="false"]').waitFor({ timeout: 15000 }).catch(async (error) => {
          console.error(errors, await page.locator('body').innerText())
          throw error
        })
        await page.locator('.dashboard-violations-table tbody tr').first().waitFor()
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        const layout = await page.evaluate(() => {
          const rect = (selector) => {
            const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect()
            return { x, y, width, height }
          }
          const overflowing = [...document.querySelectorAll('.dashboard-attendance-totals small, .dashboard-active-service strong, .dashboard-student strong')]
            .filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent)
          const header = document.querySelector('.topbar').getBoundingClientRect()
          const controls = [...document.querySelectorAll('.topbar button')].filter((el) => el.getClientRects().length)
          const clippedControls = controls.filter((el) => {
            const bounds = el.getBoundingClientRect()
            return bounds.left < header.left || bounds.right > header.right || bounds.bottom > header.bottom
          }).map((el) => el.getAttribute('aria-label'))
          const smallControls = controls.filter((el) => {
            const bounds = el.getBoundingClientRect()
            return bounds.width < 44 || bounds.height < 44
          }).map((el) => el.getAttribute('aria-label'))
          return { pageOverflow: document.documentElement.scrollWidth > innerWidth,
            headerColor: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
            totals: rect('.dashboard-attendance-totals'), roster: rect('.dashboard-active-students'), overflowing, clippedControls, smallControls }
        })
        const label = `${theme} ${width}x${height} ${zoom * 100}%`
        assert.match(layout.headerColor, /^rgb\(/, `${label}: sticky header must be opaque`)
        assert.equal(layout.pageOverflow, false, `${label}: page-wide horizontal overflow`)
        assert.deepEqual(layout.overflowing, [], `${label}: clipped attendance/student labels`)
        assert.deepEqual(layout.clippedControls, [], `${label}: header controls clipped`)
        assert.deepEqual(layout.smallControls, [], `${label}: header controls smaller than 44px`)
        assert.ok(layout.totals.y + layout.totals.height <= layout.roster.y, `${label}: attendance totals must sit above sessions`)
        assert.equal(await page.locator('.dashboard-active-service').count(), 3, `${label}: sessions missing`)
        assert.equal(await page.locator('.timer-limit-notice').count(), 1, `${label}: expired-session notice missing`)
        assert.ok(!(await page.locator('.recent-activity-card').innerText()).includes('opened'), `${label}: current statuses presented as events`)
        await page.evaluate(() => window.scrollTo(0, 400))
        const headerY = (await page.locator('.topbar').boundingBox()).y
        if (headerY < 0) console.error(await page.locator('.topbar').evaluate((el) => {
          const chain = []
          for (let node = el; node; node = node.parentElement) {
            const css = getComputedStyle(node)
            chain.push([node.className || node.tagName, css.position, css.overflowX, css.overflowY])
          }
          return chain
        }))
        assert.ok(headerY >= 0, `${label}: sticky header missing`)
        if (zoom === 1) {
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
        }
        console.log(`PASS ${label}`)
      }
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`${origin}admin/dashboard`)
  await page.locator('.dashboard-active-service').first().waitFor()
  await page.getByRole('button', { name: 'Collapse navigation' }).click()
  assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width), 80)
  await page.getByRole('button', { name: 'Expand navigation' }).click()
  await page.locator('.profile-menu-trigger').click()
  await page.getByRole('menu').waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('menu').count(), 0)
  assert.equal(await page.locator('.profile-menu-trigger').evaluate((el) => el === document.activeElement), true)
  assert.notEqual(await page.locator('.profile-menu-trigger').evaluate((el) => getComputedStyle(el).outlineStyle), 'none')
  await page.getByRole('button', { name: 'Add Student', exact: true }).click()
  await page.waitForURL('**/admin/students')
  await page.goto(`${origin}admin/dashboard`)
  const search = page.getByRole('searchbox', { name: 'Search students' })
  await search.fill('Maria')
  await search.press('Enter')
  await page.waitForURL('**/admin/students')
  for (const state of ['empty', 'loading', 'error']) {
    scenario = state
    await page.goto(`${origin}admin/dashboard`)
    if (state === 'loading') {
      await page.locator('.admin-dashboard[aria-busy="true"]').waitFor()
      await page.locator('.admin-dashboard[aria-busy="false"]').waitFor()
    }
    else {
      await page.locator('.admin-dashboard[aria-busy="false"]').waitFor()
      await page.getByText(state === 'empty' ? 'No violations available.' : 'Violations unavailable.', { exact: true }).waitFor()
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, state)
    console.log(`PASS ${state}`)
  }
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('Dashboard layout and interaction checks passed.')
} finally {
  await browser?.close()
  await server.close()
}
