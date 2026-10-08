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
let caseItems = violations
let unread = 35
let notifications = []
const resetNotifications = (count) => {
  unread = count
  notifications = Array.from({ length: Math.min(count, 100) }, (_, index) => ({
    id: index + 1, title: `Account update ${index + 1}`, message: 'A new account update is available.',
    notification_type: 'SYSTEM', category: index === 1 ? 'SECURITY' : 'SYSTEM', severity: 'INFO',
    is_read: false, read_at: null, acknowledged_at: null, created_at: '2026-10-08T01:00:00Z'
  }))
}
resetNotifications(unread)
const checkNotificationCount = async (page, count) => {
  await page.getByRole('button', { name: `${count} unread notifications`, exact: true }).waitFor()
  const expected = count > 99 ? '99+' : String(count)
  const bellBadge = page.locator('.notification-button .notification-count-badge')
  const sidebarBadge = page.locator('.sidebar').getByRole('button', { name: 'Notifications', exact: true, includeHidden: true }).locator('.nav-pending-badge')
  for (const badge of [bellBadge, sidebarBadge]) {
    assert.equal(await badge.count(), count ? 1 : 0, `${badge === bellBadge ? 'bell' : 'sidebar'} badge visibility for ${count}`)
    if (!count) continue
    assert.equal(await badge.textContent(), expected)
    if (!await badge.isVisible()) continue
    assert.equal(await badge.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      const text = range.getBoundingClientRect()
      const control = element.closest('button').getBoundingClientRect()
      return text.left >= bounds.left && text.right <= bounds.right && text.top >= bounds.top && text.bottom <= bounds.bottom
        && bounds.left >= control.left && bounds.right <= control.right && bounds.top >= control.top && bounds.bottom <= control.bottom
    }), true, `badge text clipped for ${count}`)
  }
}
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
      if (route.request().method() === 'PATCH' && url.pathname.startsWith('/api/notifications/')) {
        if (url.pathname.endsWith('/read-all')) {
          const updated = unread
          unread = 0
          notifications = notifications.map((item) => ({ ...item, is_read: true }))
          await route.fulfill({ json: { success: true, updated } })
        } else {
          const id = Number(url.pathname.split('/')[3])
          const item = notifications.find((notification) => notification.id === id)
          if (!item) throw new Error(`Unexpected notification mutation: ${url.pathname}`)
          if (!item.is_read) unread -= 1
          item.is_read = true
          item.read_at = '2026-10-08T02:00:00Z'
          if (url.pathname.endsWith('/acknowledge')) item.acknowledged_at = item.read_at
          await route.fulfill({ json: { success: true, notification: item } })
        }
        return
      }
      const empty = scenario === 'empty'
      const payloads = {
        '/api/auth/session': { user },
        '/api/students': { students: empty ? [] : students },
        '/api/violations': { violations: empty ? [] : caseItems },
        '/api/violations/types': { violationTypes: [] },
        '/api/community-service': { assignments: empty ? [] : assignments },
        '/api/community-service/active-sessions': { sessions: empty ? [] : sessions },
        '/api/community-service/assignment-options': { destinations: [] },
        '/api/clearance': { clearanceRecords: [] },
        '/api/notifications': { notifications, summary: { unread, total: Math.max(notifications.length, unread) } }
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
          const overflowing = [...document.querySelectorAll('.dashboard-attendance-totals small, .dashboard-active-service strong, .dashboard-student strong, .recent-activity-card li strong, .recent-activity-card .case-offense')]
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
          const caseOverlap = [...document.querySelectorAll('.recent-activity-card li')].some((row) => {
            const content = row.querySelector('.case-details')?.getBoundingClientRect()
            const metadata = row.querySelector('.case-meta')?.getBoundingClientRect()
            return !content || !metadata || (content.left < metadata.right && content.right > metadata.left && content.top < metadata.bottom && content.bottom > metadata.top)
          })
          const card = document.querySelector('.recent-activity-card').getBoundingClientRect()
          const list = document.querySelector('.recent-activity-card ul').getBoundingClientRect()
          return { pageOverflow: document.documentElement.scrollWidth > innerWidth, caseOverlap, caseBottomSpace: card.bottom - list.bottom,
            headerColor: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
            totals: rect('.dashboard-attendance-totals'), roster: rect('.dashboard-active-students'), overflowing, clippedControls, smallControls }
        })
        const label = `${theme} ${width}x${height} ${zoom * 100}%`
        assert.match(layout.headerColor, /^rgb\(/, `${label}: sticky header must be opaque`)
        assert.equal(layout.pageOverflow, false, `${label}: page-wide horizontal overflow`)
        assert.deepEqual(layout.overflowing, [], `${label}: clipped attendance/student labels`)
        assert.deepEqual(layout.clippedControls, [], `${label}: header controls clipped`)
        assert.deepEqual(layout.smallControls, [], `${label}: header controls smaller than 44px`)
        assert.equal(layout.caseOverlap, false, `${label}: case content and metadata overlap or are missing`)
        assert.ok(layout.caseBottomSpace < 40, `${label}: case card stretches beyond its content`)
        assert.equal(await page.locator('.recent-activity-card li').count(), 3, `${label}: recent cases missing`)
        assert.equal(await page.locator('.recent-activity-card li strong').first().textContent(), 'Rollz-Steven Maballo Mahilum')
        assert.equal(await page.locator('.case-offense').first().textContent(), violations[0].exact_offense)
        await checkNotificationCount(page, unread)
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
  await checkNotificationCount(page, unread)
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
  for (const theme of ['light', 'dark']) {
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 })
      for (const count of [0, 1, 35, 120]) {
        resetNotifications(count)
        await page.goto(`${origin}admin/dashboard`)
        await page.locator('.admin-dashboard[aria-busy="false"]').waitFor()
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        if (width === 390) await page.getByRole('button', { name: 'Open navigation menu' }).click()
        await checkNotificationCount(page, count)
        if (width === 1366) {
          await page.getByRole('button', { name: 'Collapse navigation' }).click()
          await checkNotificationCount(page, count)
          await page.getByRole('button', { name: 'Expand navigation' }).click()
        }
        await page.locator('.sidebar').getByRole('button', { name: 'Notifications', exact: true }).click()
        await page.waitForURL('**/admin/notifications')
        assert.equal(await page.locator('.sidebar .nav-item.active').getAttribute('aria-label'), 'Notifications')
        if (count === 35) {
          await page.locator('.notification-list > article').first().getByRole('button', { name: 'Mark as read', exact: true }).click()
          await checkNotificationCount(page, 34)
          await page.getByRole('button', { name: 'Acknowledge', exact: true }).click()
          await checkNotificationCount(page, 33)
          await page.getByRole('button', { name: 'Mark all read', exact: true }).click()
          await checkNotificationCount(page, 0)
        }
        console.log(`PASS notifications ${theme} ${width}px count ${count}`)
      }
    }
  }
  caseItems = [
    { ...violations[3], exact_offense: '', violation_name: 'Handbook offense fallback', incident_time: null },
    { ...violations[0], student_name: '', exact_offense: '', incident_date: null, incident_time: null },
    { ...violations[1], student_name: 'LongStudentName'.repeat(8), exact_offense: 'LongOffenseDescription'.repeat(12) }
  ]
  await page.goto(`${origin}admin/dashboard`)
  await page.locator('.admin-dashboard[aria-busy="false"]').waitFor()
  const caseRows = page.locator('.recent-activity-card li')
  assert.equal(await caseRows.nth(0).locator('.status-badge').textContent(), 'Clear')
  assert.equal(await caseRows.nth(0).locator('.case-offense').textContent(), 'Handbook offense fallback')
  assert.match(await caseRows.nth(0).locator('time').textContent(), /Time not recorded/)
  assert.equal(await caseRows.nth(1).locator('strong').textContent(), 'Student #2')
  assert.equal(await caseRows.nth(1).locator('.case-offense').textContent(), 'Recorded offense')
  assert.match(await caseRows.nth(1).locator('time').textContent(), /Not recorded.*Time not recorded/)
  assert.equal(await caseRows.nth(1).locator('time').getAttribute('datetime'), null)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'case fallbacks and unbroken text')
  await page.locator('.recent-activity-card').getByRole('button', { name: 'View All', exact: true }).click()
  await page.waitForURL('**/admin/violations')
  caseItems = violations
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
      await page.locator('.recent-activity-card').getByText(state === 'empty' ? 'No recent cases.' : 'Cases unavailable.', { exact: true }).waitFor()
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
