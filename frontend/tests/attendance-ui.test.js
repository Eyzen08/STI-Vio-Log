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
  for (const name of ['AttendanceIndicator', 'ServiceCountdown', 'StudentDashboard', 'StudentCommunityService', 'AdminDashboard', 'DashboardQuickActions', 'StudentManagement', 'ViolationManagement']) {
    components[name] = (await server.ssrLoadModule(`/src/components/${name}.jsx`)).default
  }
  components.StudentRecordContent = (await server.ssrLoadModule('/src/components/StudentRecordDrawer.jsx')).StudentRecordContent
  components.StudentServiceTimeContent = (await server.ssrLoadModule('/src/components/StudentServiceTimeDrawer.jsx')).StudentServiceTimeContent
  components.ViolationDetailsContent = (await server.ssrLoadModule('/src/components/ViolationDetailsDrawer.jsx')).ViolationDetailsContent
  components.ViolationEditHistory = (await server.ssrLoadModule('/src/components/ViolationEditDrawer.jsx')).ViolationEditHistory
})
after(async () => { await server?.close() })
const render = (name, props) => renderToStaticMarkup(createElement(components[name], props))
const start = Date.parse('2026-10-05T01:00:00Z')
const active = { id: 11, session_id: 11, assignment_id: 21, student_id: 1, status: 'ACTIVE',
  time_in: new Date(start).toISOString(), time_out: null, timer_limit_seconds: 3600, department_name: 'Library' }

test('violation detail separates structured incident notes and preserves totals and action permissions', () => {
  const violation = { id: 23, student_id: 1, student_name: 'Ana Reyes', student_number: '02000', status: 'OPEN', severity: 'GRAVE', violation_name: 'Major Offense - Category D', exact_offense: 'Documented offense', description: 'Handbook offense: Documented offense\nIncident details: Recorded incident note', required_service_hours: 6, completed_service_hours: 0.75, incident_date: '2026-10-05', incident_time: '16:00:00' }
  const html = render('ViolationDetailsContent', { violation, role: 'DISCIPLINE_OFFICE', canAdd: true })
  assert.match(html, /Ana Reyes/)
  assert.match(html, /Incident Summary/)
  assert.match(html, /Recorded incident note/)
  assert.doesNotMatch(html, /Handbook offense:|Incident details:/)
  assert.match(html, /45 min/)
  assert.match(html, /5 hr 15 min/)
  assert.match(html, /Major Offense - Category D/)
  assert.match(html, /Edit audited record/)
  const closed = render('ViolationDetailsContent', { violation: { ...violation, status:'COMPLETE' }, role:'DISCIPLINE_OFFICE', canAdd:false })
  assert.doesNotMatch(closed, /Edit audited record|Reopen to edit/)
  assert.match(closed, /disabled=""/)
  const reopened = render('ViolationDetailsContent', { violation: { ...violation, status:'COMPLETE' }, role:'DISCIPLINE_ADMIN', canAdd:true })
  assert.match(reopened, /Reopen to edit/)
  const legacy = render('ViolationDetailsContent', { violation: { ...violation, description:'Legacy incident facts', exact_offense:null } })
  assert.match(legacy, /Legacy incident facts/)
})

test('audited edit history displays real transitions and credited-hour corrections without inventing staff names', () => {
  const props = { violation: { created_at:'2026-10-05T07:54:00Z' }, history:{ actions:[{ id:1, action:'INVALID_CANCEL', from_status:'OPEN', to_status:'INVALID_CANCEL', reason:'Verified duplicate', created_at:'2026-10-05T08:00:00Z', performed_by_role:'DISCIPLINE_ADMIN', performed_by_user_id:7 }], hourCorrections:[{ id:1, previous_completed_hours:0.25, new_completed_hours:1.5, created_at:'2026-10-05T08:00:00Z', reason:'Reviewed credited time', performed_by_user_id:7 }] } }
  const html = render('ViolationEditHistory', props)
  assert.match(html, /Created on/)
  assert.match(html, /Verified duplicate/)
  assert.match(html, /Discipline Administrator · User #7/)
  assert.match(html, /15 min → 1 hr 30 min/)
  assert.match(html, /Administrator #7/)
  assert.match(html, /Reviewed credited time/)
  assert.doesNotMatch(html, /No completed-hour corrections/)
  const loading = render('ViolationEditHistory', {violation:{}})
  assert.match(loading, /Loading corrections/)
  assert.doesNotMatch(loading, /No completed-hour corrections/)
  const failure = render('ViolationEditHistory', {violation:{},error:'History unavailable'})
  assert.match(failure, /History unavailable/)
  assert.doesNotMatch(failure, /No completed-hour corrections/)
})

test('violation management keeps six real metrics, seven dated rows, filters and authorized actions', () => {
  const violations = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, student_name: `Student ${index + 1}`, student_number: `02000${index + 1}`, incident_date: '2026-10-05', incident_time: '16:00:00', exact_offense: 'Recorded offense', severity: ['MINOR', 'MAJOR', 'GRAVE'][index % 3], status: ['OPEN', 'COMPLETE', 'CLEAR', 'PENDING'][index % 4] }))
  const filters = { search: '', severity: 'ALL', status: 'ALL' }
  const props = { violations, filters, role: 'DISCIPLINE_OFFICE' }
  const html = render('ViolationManagement', props)
  assert.equal((html.match(/class="management-metric /g) || []).length, 6)
  assert.equal((html.match(/<th scope="col"/g) || []).length, 7)
  assert.equal((html.match(/class="violation-student"/g) || []).length, 7)
  assert.match(html, /Showing 1–7 of 12 records/)
  assert.match(html, /October 5, 2026<\/span><small>4:00 PM/)
  assert.match(html, /View violation 12/)
  assert.doesNotMatch(html, /View violation 5|Edit violation 12/)
  assert.match(html, /Edit violation 9/)
  assert.match(html, /value="PENDING">Pending/)
  const admin = render('ViolationManagement', { ...props, role: 'DISCIPLINE_ADMIN' })
  assert.match(admin, /Edit violation 12/)
  const filtered = render('ViolationManagement', { ...props, filters: { ...filters, search: 'student 9', severity: 'GRAVE', status: 'OPEN' } })
  assert.match(filtered, /1 record/)
  assert.equal((filtered.match(/class="violation-student"/g) || []).length, 1)
  assert.match(filtered, /View violation 9/)
  const empty = render('ViolationManagement', { ...props, filters: { ...filters, status: 'INVALID_CANCEL' } })
  assert.match(empty, /No violations match the selected filters/)
  assert.doesNotMatch(empty, /Violation records pagination/)
  const loading = render('ViolationManagement', { ...props, loading: true })
  assert.match(loading, /Loading violation records/)
  assert.doesNotMatch(loading, /View violation 12/)
})

test('student record overview uses full API totals, two case previews and four accessible tabs', () => {
  const violations = Array.from({ length: 3 }, (_, index) => ({ id: index + 1, student_id: 1, status: 'OPEN', severity: 'MAJOR', violation_name: `Case ${index + 1}`, exact_offense: 'Documented handbook offense', description: 'Recorded incident details', required_service_hours: 2, completed_service_hours: 0.5 }))
  violations.unshift({ id: 88, student_id: 2, status: 'OPEN', violation_name: 'Other student case' })
  const html = render('StudentRecordContent', { student: { id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '02000123456', academic_level: 'SENIOR_HIGH_SCHOOL', strand: 'STEM', year_level: 11 }, violations,
    summary: { total: 30, open: 5, resolved: 25, remainingHours: 5.25, condition: 'Requires action', offenseStatus: { indicator_level: 'MAJOR_LEVEL', major_level_review_required: true } } })
  assert.equal((html.match(/role="tab" /g) || []).length, 4)
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 4)
  assert.match(html, /aria-selected="true" tabindex="0">Overview/)
  assert.match(html, /Violations \(30\)/)
  assert.match(html, /5 hr 15 min/)
  assert.match(html, /Grade 11/)
  assert.match(html, /STEM/)
  assert.equal((html.match(/class="record-case-card record-case-preview"/g) || []).length, 2)
  assert.match(html, /Recorded incident details/)
  assert.match(html, /Case 1/)
  assert.match(html, /Case 2/)
  assert.doesNotMatch(html, /Other student case|Case 3/)
  assert.match(html, /Student Information/)
  assert.doesNotMatch(html, /record-case-service|Handbook sanction reference|record-discipline-status|Review required for repeated minor offenses/)
  assert.equal((html.match(/Major Level/g) || []).length, 1)
  assert.equal((html.match(/5 hr 15 min/g) || []).length, 1)
  assert.match(html, /Edit photo for Ana Reyes/)
  assert.doesNotMatch(html, /type="file"|Photo change reason/)
  const duplicate = render('StudentRecordContent', { student: { id: 1, first_name: 'Ana' }, violations: [{ id: 1, student_id: 1, violation_name: 'Documented offense', exact_offense: 'Documented offense', description: 'Documented offense' }] })
  assert.equal((duplicate.match(/Documented offense/g) || []).length, 1)
})

test('embedded service content keeps assignments, credited time, corrections and attendance', () => {
  const html = render('StudentServiceTimeContent', { student: { id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '02000123456' }, assignments: [
    { id: 21, student_id: 1, status: 'IN_PROGRESS', department_name: 'Library', department_head_first_name: 'Ana', department_head_last_name: 'Montana', required_hours: 4, remaining_hours: 3, hour_corrections: [{ id: 8, assignment_id: 21, previous_completed_hours: 0.5, new_completed_hours: 1, reason: 'Verified attendance correction' }] },
    { id: 22, student_id: 2, status: 'OPEN', department_name: 'Other Department', required_hours: 10, remaining_hours: 10 }
  ], activeSessions: [active] })
  assert.match(html, /Assignment #21/)
  assert.match(html, /Ana Montana/)
  assert.match(html, /aria-label="Credited progress for assignment #21" aria-valuemin="0" aria-valuemax="100" aria-valuenow="25"/)
  assert.match(html, /1 hr completed of 4 hr/)
  assert.match(html, /3 hr remaining/)
  assert.match(html, /25%/)
  assert.match(html, /Verified attendance correction/)
  assert.match(html, /TIME IN/)
  assert.doesNotMatch(html, /Other Department|Assignment #22/)
})

test('service drawer has explicit zero totals, attendance and corrections when there are no assignments', () => {
  const html = render('StudentServiceTimeContent', { student: { id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '02000123456' }, activeSessions: [], assignments: [] })
  assert.match(html, /TIME OUT/)
  assert.match(html, /Not currently serving/)
  assert.match(html, /0 assignments/)
  assert.match(html, /No community service assignments yet/)
  assert.match(html, /No completed-hour corrections recorded/)
  assert.match(html, /aria-label="Overall credited service progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"/)
  assert.equal((html.match(/<strong>0 min<\/strong>/g) || []).length, 3)
})

test('student directory keeps five compact rows, real counts, and only relevant attendance', () => {
  const students = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, first_name: `Student ${index + 1}`, last_name: 'Test', student_number: `0200010000${index}`, program: 'BSIT', section: 'A101', year_level: 2 }))
  const html = render('StudentManagement', { students, activeSessions: [active], onQueryChange() {}, violations: [{ student_id: 1, status: 'OPEN', severity: 'GRAVE' }], clearances: [{ student_id: 2, status: 'CLEARED' }], assignments: [{ student_id: 1, status: 'OPEN', required_hours: 5, remaining_hours: 4 }] })
  assert.equal((html.match(/scope="col"/g) || []).length, 6)
  assert.equal((html.match(/class="directory-student"/g) || []).length, 5)
  assert.equal((html.match(/class="directory-timed-in"/g) || []).length, 1)
  assert.equal((html.match(/<progress/g) || []).length, 1)
  assert.match(html, /1 hr \/ 5 hr/)
  assert.match(html, /Showing 1–5 of 7 students/)
  assert.match(html, /Academic Info/)
  assert.match(html, /clearance-cleared">Cleared/)
  assert.match(html, /aria-label="More actions for Student 1 Test"/)
  assert.doesNotMatch(html, /TIME OUT|Offense indicator legend|Show Service Time|Guardian Contact/)
})

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
