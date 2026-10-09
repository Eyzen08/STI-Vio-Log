// Uses intercepted API fixtures; never modifies school records.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../artifacts/notification-targets/', import.meta.url))
const student = { id: 1, student_number: '02000123456', first_name: 'Maria', last_name: 'Santos', program: 'BSIT', section: 'A301' }
const otherStudent = { ...student, id: 2, student_number: '02000123457', first_name: 'Ana' }
const violation = { id: 12, student_id: 1, violation_name: 'Uniform violation', exact_offense: 'Uniform violation', severity: 'MINOR', status: 'OPEN', incident_date: '2026-10-08', required_service_hours: 4, completed_service_hours: 2, remaining_service_hours: 2, history: [] }
const assignment = { id: 23, assignment_id: 23, violation_id: 12, student_id: 1, ...student, department_id: 1, department_name: 'Library', status: 'IN_PROGRESS', required_hours: 4, completed_hours: 2, remaining_hours: 2, required_minutes: 240, credited_minutes: 120, remaining_minutes: 120 }
assignment.id = 23
const session = { id: 34, session_id: 34, assignment_id: 23, student_id: 1, department_id: 1, department_name: 'Library', status: 'COMPLETED', time_in: '2026-10-08T01:00:00Z', time_out: '2026-10-08T03:00:00Z', session_type: 'OPEN_TIME', worked_minutes: 120, credited_minutes: 120, attendance_outcome: 'NORMAL', notes: 'Exact session note' }
const dtr = { assignments: [assignment], sessions: [session] }
const certificate = { id: 67, certificate_number: 'CERT-67', student_name: 'Maria Santos', student_number: student.student_number, completed_hours: 4, status: 'ISSUED', version: 1, issue_date: '2026-10-08' }
const clearance = { id: 56, student_id: 1, ...student, academic_year: '2026-2027', semester: '1st Semester', status: 'CLEARED', cleared_at: '2026-10-08', remarks: 'Exact clearance note' }
clearance.id = 56
const conversation = { id: 45, student_number: student.student_number, student_name: 'Maria Santos', subject: 'Target conversation', school_participant: 'Discipline Office', status: 'OPEN' }
const notifications = [
  { resource_type: 'violations', resource_id: 12, category: 'VIOLATIONS', title: 'Violation update' },
  { resource_type: 'community_service_assignments', resource_id: 23, category: 'COMMUNITY_SERVICE', title: 'Assignment update' },
  { resource_type: 'community_service_sessions', resource_id: 34, metadata: { assignment_id: 23 }, category: 'ATTENDANCE', title: 'Attendance update' },
  { resource_type: 'message_conversations', resource_id: 45, category: 'MESSAGES', title: 'Message update' },
  { resource_type: 'student_clearance', resource_id: 56, category: 'CLEARANCE', title: 'Clearance update' },
  { resource_type: 'clearance_certificates', resource_id: 67, category: 'CLEARANCE', title: 'Certificate update' },
  { category: 'SECURITY', title: 'Security update' },
  { category: 'COMMUNITY_SERVICE', title: 'Legacy update' },
  { resource_type: 'violations', resource_id: 999, category: 'VIOLATIONS', title: 'Unavailable update' },
  { resource_type: 'students', resource_id: 1, category: 'ATTENDANCE', title: 'Rejected scan' }
].map((item, i) => ({ id: i + 1, is_read: false, created_at: '2026-10-08T01:00:00Z', message: 'Review this update.', ...item }))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
let browser
let activePage
let checks = 0
const raceOnly = process.argv.includes('--history-race-only')
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  await mkdir(output, { recursive: true })
  for (const viewport of (raceOnly ? [{ width: 1280, height: 900 }] : [{ width: 1280, height: 900 }, { width: 390, height: 844 }])) {
    for (const role of (raceOnly ? ['DISCIPLINE_ADMIN'] : ['STUDENT', 'DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD'])) {
      const user = { id: 3, role, username: 'notification-test', full_name: 'Test User', department_id: 1 }
      const prefix = role === 'STUDENT' ? '/student' : role === 'DEPARTMENT_HEAD' ? '/department' : '/admin'
      const page = await browser.newPage({ viewport, bypassCSP: true })
      activePage = page
      page.setDefaultTimeout(10000)
      const errors = []
      const notificationWrites = []
      let releaseHistory
      let historyStarted
      const pendingHistory = new Promise((resolve) => { historyStarted = resolve })
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript((user) => localStorage.setItem('sti_vio_log_user', JSON.stringify(user)), user)
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (!url.pathname.startsWith('/api/')) {
          if (url.origin === new URL(origin).origin) await route.continue()
          else await route.abort()
          return
        }
        if (route.request().method() !== 'GET' && url.pathname.startsWith('/api/notifications')) notificationWrites.push(url.pathname)
        if (url.pathname === '/api/violations/student/1' && url.searchParams.get('page') === '2') {
          await new Promise((resolve) => { releaseHistory = resolve; historyStarted() })
        }
        const payloads = {
          '/api/auth/session': { user }, '/api/students': { students: [student, otherStudent] }, '/api/violations': { violations: [violation] },
          '/api/violations/types': { violationTypes: [] }, '/api/community-service': { assignments: [assignment] },
          '/api/community-service/active-sessions': { sessions: [] }, '/api/community-service/assignment-options': { destinations: [] },
          '/api/community-service/results/pending': { results: [] }, '/api/clearance': { clearanceRecords: [clearance] },
          '/api/notifications': { notifications, summary: { total: notifications.length, unread: notifications.length } },
          '/api/students/me': { student }, '/api/students/me/violations': { violations: [violation] },
          '/api/students/me/community-service': { assignments: [assignment] }, '/api/students/me/community-service/dtr': dtr,
          '/api/student/clearance': { clearanceRecords: [clearance] }, '/api/student/clearance/eligibility': { eligibility: { eligible: true } },
          '/api/student/clearance/certificates': { certificates: [certificate] }, '/api/community-service/23/sessions': { sessions: [session] },
          '/api/community-service/23': { assignment }, '/api/violations/student/1': { violations: [violation], summary: { total: 2, open: 2 }, pagination: { hasMore: url.searchParams.get('page') !== '2' } },
          '/api/violations/student/2': { violations: [], summary: { total: 0, open: 0 }, pagination: { hasMore: false } },
          '/api/messages/conversations': { conversations: [], pagination: { total: 0, pages: 1 } },
          '/api/messages/conversations/45': { conversation, messages: [{ id: 1, message_text: 'Exact conversation message', created_at: '2026-10-08T01:00:00Z', sender_name: 'Discipline Office' }], pagination: { pages: 1 } },
          '/api/clearance/certificates/students': { students: [] }, '/api/clearance/certificates': { certificates: [certificate] },
          '/api/clearance/56': { clearanceRecord: clearance }, '/api/account/admin-profile': { profile: { first_name: 'Test', last_name: 'Admin', username: 'notification-test', email: 'test@example.test', email_verified: true } }
        }
        const missing = ['/api/violations/999','/api/messages/conversations/999'].includes(url.pathname)
        await route.fulfill({ status: missing ? 404 : 200, json: { success: !missing, ...(payloads[url.pathname] || {}) } })
      })
      const open = async (title) => {
        await page.goto(`${origin}${prefix}/notifications`)
        await page.locator('.notification-list article').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button', { name: 'Open record' }).click()
      }
      const changeTarget = async (path) => page.evaluate((path) => {
        window.history.pushState({}, '', path)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
      const checkHistoryRace = async () => {
        await open('Rejected scan')
        await page.getByRole('tab', { name: 'Violations (2)', exact: true }).click()
        await page.getByRole('button', { name: 'Load older violations' }).click()
        await pendingHistory
        await changeTarget('/admin/students?student_id=2')
        await page.getByRole('tab', { name: 'Violations (0)', exact: true }).waitFor()
        const response = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/violations/student/1' && new URL(response.url()).searchParams.get('page') === '2')
        releaseHistory()
        await response
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        assert.equal(await page.getByRole('tab', { name: 'Violations (0)', exact: true }).count(), 1, 'A delayed page from another student must not replace the current summary')
        checks++
      }
      if (raceOnly) {
        await checkHistoryRace()
        await page.close()
        continue
      }
      await open('Assignment update')
      if (role === 'STUDENT') await page.locator('#service-assignment-23').waitFor()
      else {
        await page.getByRole('dialog', { name: 'Service assignment #23' }).waitFor()
        await page.getByRole('button', { name: 'Close Service assignment #23' }).click()
        assert.ok(!new URL(page.url()).searchParams.has('assignment_id'))
        await page.reload()
        await page.getByRole('heading', { name: 'Community Service', exact: true }).waitFor().catch(() => page.getByRole('heading', { name: 'Community service', exact: true }).waitFor())
        assert.equal(await page.getByRole('dialog').count(), 0)
      }
      checks++
      await open('Attendance update')
      await page.locator('#service-session-34').waitFor()
      await page.locator('#service-session-34').getByText('Exact session note', { exact: true }).waitFor()
      if (role === 'STUDENT') assert.equal(await page.locator('#service-session-34 details').evaluate((element) => element.open), true)
      await page.reload()
      await page.locator('#service-session-34').waitFor()
      await page.screenshot({ path: `${output}${role}-${viewport.width}-session.png`, fullPage: true })
      checks++
      await changeTarget(`${prefix}/community-service?assignment_id=23&session_id=999`)
      await page.getByRole('alert').filter({ hasText: /requested record is unavailable/ }).waitFor()
      assert.equal(await page.locator('#service-session-34').count(), role === 'STUDENT' ? 1 : 0, 'A missing target must not substitute another session in its details')
      await changeTarget(`${prefix}/community-service?assignment_id=23&session_id=34`)
      await page.locator('#service-session-34').getByText('Exact session note', { exact: true }).waitFor()
      checks++
      if (role !== 'DEPARTMENT_HEAD') {
        await open('Violation update')
        if (role === 'STUDENT') await page.locator('#violation-details-12').waitFor()
        else await page.getByRole('dialog').waitFor()
        await page.goBack()
        await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor()
        await page.goForward()
        if (role === 'STUDENT') await page.locator('#violation-details-12').waitFor()
        else await page.getByRole('dialog').waitFor()
        checks++
        if (role === 'STUDENT') {
          await page.locator('#violation-record-12 .violation-summary').click()
          assert.ok(!new URL(page.url()).searchParams.has('violation_id'))
          await page.locator('#violation-record-12 .violation-summary').click()
          await page.locator('#violation-details-12').waitFor()
          assert.equal(new URL(page.url()).searchParams.get('violation_id'), '12')
          checks++
        }
        await open('Message update')
        await page.getByText('Exact conversation message', { exact: true }).waitFor()
        await changeTarget(`${prefix}/messages?conversation_id=999`)
        await page.getByRole('alert').filter({ hasText: /requested conversation is unavailable/ }).waitFor()
        assert.equal(await page.getByText('Exact conversation message', { exact: true }).count(), 0)
        await page.goBack()
        await page.getByText('Exact conversation message', { exact: true }).waitFor()
        checks++
        await open('Clearance update')
        await page.locator('#clearance-record-56').getByText('Exact clearance note', { exact: true }).waitFor()
        checks++
        await open('Certificate update')
        await page.locator('#certificate-record-67').waitFor()
        checks++
        await open('Unavailable update')
        await page.getByRole('alert').filter({ hasText: /unavailable/ }).waitFor()
        assert.equal(await page.getByRole('dialog').count(), 0)
        checks++
      }
      await open('Security update')
      await page.locator('#account-security').waitFor()
      await page.waitForFunction(() => document.activeElement?.id === 'account-security')
      checks++
      await open('Legacy update')
      await page.getByRole('alert').filter({ hasText: /specific notification record is unavailable/ }).waitFor()
      checks++
      if (prefix === '/admin') {
        await checkHistoryRace()
      }
      assert.deepEqual(notificationWrites, [], 'Opening a record must not mark or acknowledge the notification')
      assert.deepEqual(errors, [], `${role} ${viewport.width}: browser exceptions`)
      console.log(`${role} ${viewport.width}: passed`)
      await page.screenshot({ path: `${output}${role}-${viewport.width}.png`, fullPage: true })
      await page.close()
    }
  }
  console.log(`${checks} notification browser scenarios passed${raceOnly ? ' (delayed history response)' : ' across four roles and desktop/mobile viewports'}.`)
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    console.log(await activePage.locator('body').innerText())
    await activePage.screenshot({ path: `${output}failure.png`, fullPage: true })
  }
  throw error
} finally {
  await browser?.close()
  await server.close()
}
