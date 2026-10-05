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
  for (const name of ['AttendanceIndicator', 'ServiceCountdown', 'StudentDashboard', 'StudentCommunityService', 'AdminDashboard']) {
    components[name] = (await server.ssrLoadModule(`/src/components/${name}.jsx`)).default
  }
})
after(async () => { await server?.close() })
const render = (name, props) => renderToStaticMarkup(createElement(components[name], props))
const start = Date.parse('2026-10-05T01:00:00Z')
const active = { id: 11, session_id: 11, assignment_id: 21, student_id: 1, status: 'ACTIVE',
  time_in: new Date(start).toISOString(), time_out: null, timer_limit_seconds: 3600, department_name: 'Library' }

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

test('admin roster displays both states and counts students rather than sessions', () => {
  const html = render('AdminDashboard', {
    students: [{ id: 1, first_name: 'Ana', last_name: 'Reyes' }, { id: 2, first_name: 'Ben', last_name: 'Cruz' }],
    assignments: [{ id: 21, student_id: 1 }, { id: 22, student_id: 1 }, { id: 23, student_id: 2 }],
    activeSessions: [active, { ...active, id: 12, session_id: 12, assignment_id: 22, department_name: 'Clinic' }],
    role: 'DISCIPLINE_ADMIN', onNavigate() {}
  })
  assert.match(html, /Current attendance status/)
  assert.match(html, /TIME IN/)
  assert.match(html, /TIME OUT/)
  assert.match(html, /Ben Cruz/)
  assert.match(html, /Library/)
  assert.match(html, /Clinic/)
  assert.match(html, /Students timed in<\/span><strong>1<\/strong>/)
  assert.equal((html.match(/data-label="Attendance status"/g) || []).length, 2)
})
