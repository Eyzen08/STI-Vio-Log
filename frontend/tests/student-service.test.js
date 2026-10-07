import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { formatMinutes, summarizeStudentService, validateDateRange } from '../src/lib/studentService.js'

test('student DTR totals derive from authoritative minute fields', () => {
  assert.deepEqual(summarizeStudentService({
    assignments: [{ required_minutes: 180, credited_minutes: 75, remaining_minutes: 105 }],
    sessions: [{ status: 'COMPLETED' }, { status: 'ACTIVE' }]
  }), { requiredMinutes: 180, creditedMinutes: 75, remainingMinutes: 105, completedSessions: 1, activeSessions: 1 })
  assert.equal(formatMinutes(135), '2h 15m')
})

test('cancelled service obligations do not inflate student totals', () => {
  assert.deepEqual(summarizeStudentService({ assignments: [{ status: 'INVALID_CANCELLED', required_minutes: 180, credited_minutes: 60, remaining_minutes: 120 }], sessions: [{ status: 'COMPLETED' }] }), { requiredMinutes: 0, creditedMinutes: 0, remainingMinutes: 0, completedSessions: 1, activeSessions: 0 })
})

test('student DTR summary remains safe while data is loading or malformed', () => {
  const empty = { requiredMinutes: 0, creditedMinutes: 0, remainingMinutes: 0, completedSessions: 0, activeSessions: 0 }
  assert.deepEqual(summarizeStudentService(null), empty)
  assert.deepEqual(summarizeStudentService(undefined), empty)
  assert.deepEqual(summarizeStudentService({ assignments: null, sessions: 'invalid' }), empty)
})

test('student DTR date ranges reject inverted or malformed values', () => {
  assert.equal(validateDateRange({ from: '2026-08-28', to: '2026-08-27' }), 'From date must be on or before To date.')
  assert.equal(validateDateRange({ from: 'not-a-date', to: '' }), 'From date must use YYYY-MM-DD.')
  assert.equal(validateDateRange({ from: '2026-02-30', to: '' }), 'From date must use YYYY-MM-DD.')
  assert.equal(validateDateRange({ from: '2026-08-27', to: '2026-08-28' }), '')
})

test('student dashboard and DTR render active sessions with live credited-safe timers', async () => {
  const dashboard = await readFile(new URL('../src/components/StudentDashboard.jsx', import.meta.url), 'utf8')
  const service = await readFile(new URL('../src/components/StudentCommunityService.jsx', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  const countdown = await readFile(new URL('../src/components/ServiceCountdown.jsx', import.meta.url), 'utf8')
  for (const source of [dashboard, service]) {
    assert.match(source, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 1000\)/)
    assert.match(source, /<ServiceCountdown session=\{session\} now=\{now\}/)
    assert.match(source, /<AttendanceIndicator/)
    assert.match(source, /clearInterval\(clock\)/)
  }
  assert.match(countdown, /Time Out required/)
  assert.match(countdown, /timing.remainingSeconds/)
  assert.match(dashboard, /Current session time is credited after Time Out is saved\./)
  assert.match(service, /isActiveServiceSession\(session\) \? 'Remaining session time' : 'Worked'/)
  assert.match(app, /setInterval\(refresh, 15000\)/)
  assert.match(app, /document\.visibilityState === 'visible'/)
  assert.match(app, /addEventListener\('visibilitychange', refresh\)/)
  assert.match(app, /dtr=\{studentDtr\}/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.student-live-session-body \{ grid-template-columns: 1fr; \}/s)
})
