import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let server
const components = {}
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  for (const name of ['AttendanceIndicator', 'ServiceCountdown', 'StudentDashboard', 'StudentCommunityService', 'AdminDashboard', 'DashboardQuickActions']) {
    components[name] = (await server.ssrLoadModule(`/src/components/${name}.jsx`)).default
  }
})
after(async () => { await server?.close() })
const render = (name, props) => renderToStaticMarkup(createElement(components[name], props))
const start = Date.parse('2026-10-05T01:00:00Z')
const active = { id: 11, session_id: 11, assignment_id: 21, student_id: 1, status: 'ACTIVE',
  time_in: new Date(start).toISOString(), time_out: null, timer_limit_seconds: 3600, department_name: 'Library' }

test('administrative dashboards keep four quick actions and compact analytics access', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
    const html = render('AdminDashboard', { role, onNavigate() {} })
    assert.doesNotMatch(html, />Graphs</)
    assert.equal((html.match(/<button/g) || []).length > 4, true)
    assert.match(html, /Offense Breakdown/)
    assert.equal((render('DashboardQuickActions', { role, onNavigate() {} }).match(/<button/g) || []).length, 4)
    assert.doesNotMatch(html, /Analytics &amp; Trends|Recorded Violations Over Time/)
  }
  for (const role of ['DEPARTMENT_HEAD', 'STUDENT']) {
    assert.doesNotMatch(render('DashboardQuickActions', { role, onNavigate() {} }), />Graphs</)
  }
})

test('countdown renders remaining time, stops at zero, and does not announce every tick', () => {
  const midway = render('ServiceCountdown', { session: active, now: start + 1800000 })
  assert.match(midway, /00:30:00/)
  assert.match(midway, /aria-label="Remaining session time"/)
  assert.doesNotMatch(midway, /aria-live|role="status"/)
  const finished = render('ServiceCountdown', { session: active, now: start + 7200000 })
  assert.match(finished, /00:00:00/)
  assert.match(finished, /Service limit reached — Time Out required/)
  assert.match(render('AttendanceIndicator', { sessions: [active] }), /TIME IN/)
  assert.match(render('ServiceCountdown', { session: {}, now: start }), /Time unavailable/)
})

test('attendance indicator distinguishes TIME OUT, loading, and unavailable data', () => {
  assert.match(render('AttendanceIndicator', { sessions: [], details: true }), /TIME OUT.*Not currently serving/)
  assert.match(render('AttendanceIndicator', { sessions: [active], ready: false, loading: true }), /Loading attendance/)
  const unavailable = render('AttendanceIndicator', { ready: false })
  assert.match(unavailable, /Attendance unavailable/)
  assert.doesNotMatch(unavailable, /TIME OUT/)
})

test('student dashboard shows TIME OUT even without a current session', () => {
  const html = render('StudentDashboard', { dtr: { assignments: [], sessions: [] }, onNavigate() {} })
  assert.match(html, /Current attendance status/)
  assert.match(html, /TIME OUT/)
  assert.match(html, /Not currently serving/)
})

test('filtered student history never hides current TIME IN or alters historical worked time', () => {
  const completed = { ...active, id: 8, status: 'COMPLETED', time_out: '2026-09-01T02:00:00Z', worked_minutes: 45 }
  const html = render('StudentCommunityService', {
    dtr: { assignments: [], sessions: [completed] },
    liveDtr: { assignments: [], sessions: [active, completed] }, onFilter() {}
  })
  assert.match(html, /TIME IN/)
  assert.match(html, /Remaining session time/)
  assert.match(html, /Worked<\/dt><dd>45m/)
  assert.match(html, /Assignment #21/)
  const unknown = render('StudentCommunityService', { dtr: { assignments: [], sessions: [completed] }, onFilter() {} })
  assert.match(unknown, /Attendance unavailable/)
})

test('admin attendance shows only active students and counts students rather than sessions', () => {
  const html = render('AdminDashboard', {
    students: [{ id: 1, first_name: 'Ana', last_name: 'Reyes' }, { id: 2, first_name: 'Ben', last_name: 'Cruz' }],
    assignments: [{ id: 21, student_id: 1 }, { id: 22, student_id: 1 }, { id: 23, student_id: 2 }],
    activeSessions: [active, { ...active, id: 12, session_id: 12, assignment_id: 22, department_name: 'Clinic' }],
    role: 'DISCIPLINE_ADMIN', onNavigate() {}
  })
  assert.match(html, /Current Attendance Status/)
  assert.match(html, /TIMED IN/)
  assert.doesNotMatch(html, /TIME OUT|Ben Cruz|type="search"/)
  assert.match(html, /Ana Reyes/)
  assert.match(html, /Library/)
  assert.match(html, /Clinic/)
  assert.match(html, /Students Timed In<\/span><strong>1<\/strong>/)
  assert.equal((html.match(/class="dashboard-active-student"/g) || []).length, 1)
})

test('admin summary derives resolved cases, severity, and progress from supplied records', () => {
  const html = render('AdminDashboard', {
    role: 'DISCIPLINE_ADMIN', onNavigate() {},
    violations: ['OPEN', 'COMPLETE', 'CLEAR', 'CANCELLED', 'PENDING'].map((status, id) => ({ id, student_id: id, student_name: `Student ${id}`, status, severity: 'GRAVE', offense_indicator_level: 'GRAVE' })),
    assignments: [{ id: 1, student_id: 1, status: 'OPEN', required_hours: 10, remaining_hours: 4 }]
  })
  assert.match(html, /Cases Resolved<\/span><strong>2<\/strong>/)
  assert.match(html, /Open Violations<\/span><strong>2<\/strong>/)
  assert.match(html, /severity-grave">Grave/)
  assert.match(html, /<progress value="60" max="100"/)
  assert.match(html, /6 hr completed/)
  assert.match(html, /4 hr remaining/)
  assert.equal((html.match(/Manage violation for/g) || []).length, 4)
  assert.match(render('AdminDashboard', { role: 'DISCIPLINE_ADMIN', onNavigate() {}, attendanceReady: false }), /Attendance unavailable/)
  assert.match(render('AdminDashboard', { role: 'DISCIPLINE_ADMIN', onNavigate() {}, error: 'Unable to load administration data' }), /role="alert"/)
})

test('admin attendance caps preview at three students and excludes ended sessions', () => {
  const html = render('AdminDashboard', {
    role: 'DISCIPLINE_ADMIN', onNavigate() {},
    activeSessions: [...[1, 2, 3, 4].map((student_id) => ({ ...active, id: student_id, session_id: student_id, student_id })), { ...active, id: 5, student_id: 5, time_out: '2026-10-05T02:00:00Z' }]
  })
  assert.equal((html.match(/class="dashboard-active-student"/g) || []).length, 3)
  assert.match(html, /View all 4 timed-in students/)
})
