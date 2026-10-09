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
  for (const name of ['AttendanceIndicator', 'ServiceCountdown', 'AdminActiveAttendance', 'StudentDashboard', 'StudentCommunityService', 'StudentProfile', 'StudentViolations', 'StudentQr', 'StudentClearance', 'AdminDashboard', 'DashboardQuickActions', 'StudentManagement', 'ViolationManagement', 'CommunityServiceManagement', 'DepartmentQrScanner']) {
    components[name] = (await server.ssrLoadModule(`/src/components/${name}.jsx`)).default
  }
  components.StudentRecordContent = (await server.ssrLoadModule('/src/components/StudentRecordDrawer.jsx')).StudentRecordContent
  components.StudentServiceTimeContent = (await server.ssrLoadModule('/src/components/StudentServiceTimeDrawer.jsx')).StudentServiceTimeContent
  components.ViolationDetailsContent = (await server.ssrLoadModule('/src/components/ViolationDetailsDrawer.jsx')).ViolationDetailsContent
  components.ViolationEditHistory = (await server.ssrLoadModule('/src/components/ViolationEditDrawer.jsx')).ViolationEditHistory
  Object.assign(components, await server.ssrLoadModule('/src/components/CommunityServiceManagement.jsx'))
})
after(async () => { await server?.close() })
const render = (name, props) => renderToStaticMarkup(createElement(components[name], { onFieldChange() {}, onFiltersChange() {}, ...props }))
const start = Date.parse('2026-10-05T01:00:00Z')
const active = { id: 11, session_id: 11, assignment_id: 21, student_id: 1, status: 'ACTIVE',
  time_in: new Date(start).toISOString(), time_out: null, timer_limit_seconds: 3600, department_name: 'Library' }

test('violation color legends remain visible with records, loading, empty and filtered results', () => {
  const violation = { id: 1, student_name: 'Ana Reyes', student_number: 'TEST-1', exact_offense: 'Recorded offense', severity: 'MINOR', status: 'OPEN', offense_indicator_level: 'MINOR_1' }
  const filters = { search: '', severity: 'ALL', status: 'ALL' }
  for (const [props, message] of [
    [{ violations: [violation] }, 'Ana Reyes'],
    [{ violations: [], loading: true }, 'Loading violation records…'],
    [{ violations: [] }, 'No violation records yet.'],
    [{ violations: [violation], filters: { ...filters, search: 'no match' } }, 'No violations match the selected filters.']
  ]) {
    const html = render('ViolationManagement', { filters, ...props })
    assert.ok(html.includes(message))
    const legendStart = html.indexOf('aria-label="Violation color legends"')
    const tableStart = html.indexOf('class="violation-table-wrap"')
    assert.ok(legendStart > html.indexOf('aria-label="Filter violation status"') && legendStart < tableStart)
    const legends = html.slice(legendStart, tableStart)
    assert.match(legends, /aria-label="Classification legend"/)
    assert.match(legends, /aria-label="Student indicator legend"/)
    for (const [severity, label] of [['minor', 'Minor'], ['major', 'Major'], ['grave', 'Grave']]) {
      assert.ok(legends.includes(`class="violation-classification classification-${severity}">${label}</span>`))
    }
    for (const [tone, label] of [['neutral', 'No qualifying offenses'], ['yellow', '1 minor'], ['orange', '2 minors'], ['red', 'Major-level'], ['critical', 'Grave']]) {
      assert.ok(legends.includes(`class="offense-indicator offense-${tone}" title="${label}" aria-label="${label}"`))
      assert.ok(legends.includes(`<span>${label}</span>`))
    }
  }
})

test('student overview renders each timer and service total once with three recent records', () => {
  const html = render('StudentDashboard', { dtr:{sessions:[active]}, assignments:[{required_hours:6,remaining_hours:5.25,status:'IN_PROGRESS'}],
    violations:Array.from({length:5},(_,id)=>({id,status:'OPEN',exact_offense:`Offense ${id}`,severity:'GRAVE',required_service_hours:2})) })
  assert.equal((html.match(/<time[^>]*aria-label="Remaining session time"/g)||[]).length,1)
  assert.equal((html.match(/5 hr 15 min/g)||[]).length,1)
  assert.equal((html.match(/class="student-recent-record"/g)||[]).length,3)
  assert.match(html, /My QR code/)
  assert.match(html, /Message Office/)
  assert.doesNotMatch(html, /Service Session in Progress|student-stats|standing-card/)
})

test('student DTR preserves active attendance and hides secondary fields in disclosures', () => {
  const html=render('StudentCommunityService',{liveDtr:{assignments:[],sessions:[active]},dtr:{assignments:[],sessions:[{...active,id:12,status:'COMPLETED',time_out:'2026-10-05T02:00:00Z',worked_minutes:45,credited_minutes:30,notes:'Preserved remarks',time_out_recorder_name:'Mara Cruz',time_out_role:'DEPARTMENT_HEAD'}]}})
  assert.equal((html.match(/<time[^>]*aria-label="Remaining session time"/g)||[]).length,1)
  assert.match(html, /See current session above/)
  assert.match(html, /<details class="student-session-details"><summary>Details<\/summary>/)
  assert.match(html, /Worked<\/dt><dd>45m/)
  assert.match(html, /Credited<\/dt><dd>30m/)
  assert.match(html, /Mara Cruz/)
  assert.match(html, /Department Head/)
  assert.match(html, /Preserved remarks/)
  assert.match(html, /<details class="student-corrections"><summary>Hour corrections<\/summary>/)
})

test('student pages retain profile data, violation facts and unavailable states', () => {
  const profile=render('StudentProfile',{profile:{first_name:'Ana',last_name:'Reyes',student_number:'02000',academic_level:'SENIOR_HIGH_SCHOOL',strand:'STEM',year_level:11},username:'ana'})
  assert.match(profile,/STEM/)
  assert.match(profile,/Grade 11/)
  assert.match(profile,/Not provided/)
  assert.doesNotMatch(profile,/<input/)
  const violation=render('StudentViolations',{violations:[{id:1,violation_name:'Major Offense - Category C',severity:'GRAVE',status:'OPEN',description:'Handbook offense: Documented offense\nIncident details: Preserved notes'}]})
  assert.match(violation,/Documented offense/)
  assert.match(violation,/Major Offense - Category C/)
  assert.match(violation,/Grave/)
  assert.match(render('StudentQr',{profile:null}),/No QR code is assigned/)
  assert.match(render('StudentClearance',{records:[],eligibility:{hasActiveViolation:true,hasPendingService:true}}),/View violations/)
  assert.match(render('StudentClearance',{records:[],eligibility:{hasActiveViolation:true,hasPendingService:true}}),/View service/)
})

test('student portal retains loading, empty, and failed-data states without invented attendance', () => {
  for (const name of ['StudentDashboard','StudentCommunityService','StudentProfile','StudentViolations','StudentQr','StudentClearance']) {
    assert.match(render(name,{loading:true,violations:[]}),/aria-live="polite"/)
    assert.match(render(name,{error:'Records unavailable',violations:[]}),/Records unavailable/)
  }
  assert.match(render('StudentDashboard',{dtr:{sessions:[]}}),/No violations on record/)
  const service=render('StudentCommunityService',{dtr:{assignments:[],sessions:[active]}})
  assert.match(service,/Current attendance unavailable/)
  assert.doesNotMatch(service,/See current session above|<time/)
  assert.match(render('StudentCommunityService',{dtr:{assignments:[],sessions:[]},liveDtr:{sessions:[]}}),/No attendance sessions match this period/)
  assert.match(render('StudentViolations',{violations:[]}),/No Violations on Record/)
  assert.match(render('StudentClearance',{}),/No clearance records yet/)
})

test('community workflow keeps assignment filters, actual attendance, eligible choices and detailed progress', () => {
  const assignment = {id:21,student_id:1,violation_id:4,first_name:'Ana',last_name:'Reyes',student_number:'02000',department_id:3,department_name:'Library',department_head_first_name:'Mara',department_head_last_name:'Cruz',status:'IN_PROGRESS',required_hours:6,remaining_hours:5.25}
  const props={assignments:[assignment],activeSessions:[active,{...active,id:12,assignment_id:22}],attendanceReady:true,filters:{search:'',department:'ALL',status:'ALL'},formProps:{destinations:[]}}
  const html=render('CommunityServiceManagement',props)
  assert.equal((html.match(/class="management-metric /g)||[]).length,5)
  assert.match(html, /<strong>1<\/strong><span>Students Timed In/)
  assert.match(html, /TIME IN/)
  assert.match(html, /5 hr 15 min/)
  assert.match(html, /View service assignment 21/)
  assert.match(render('CommunityServiceManagement',{...props,filters:{...props.filters,department:'99'}}), /No community service assignments match/)
  const details=render('ServiceAssignmentContent',{assignment})
  assert.match(details,/45 min/); assert.match(details,/13%/); assert.match(details,/Mara Cruz/)
  const form=render('AssignServiceForm',{form:{student_id:1,student_search:'02000 - Ana Reyes',violation_id:4,required_hours:1,required_minutes:60,department_id:3,department_head_id:9},violations:[{id:4,student_id:1,status:'OPEN'},{id:5,student_id:2,status:'OPEN'},{id:6,student_id:1,status:'COMPLETE'}],destinations:[{department_id:3,department_head_id:9,first_name:'Mara'},{department_id:4,department_head_id:10,first_name:'Other'}]})
  assert.match(form,/value="4" selected/); assert.doesNotMatch(form,/value="5"|value="6"|value="10"/)
})

test('assignment duration accepts minutes alone and shows the normalized total with shared help', () => {
  for (const [hours, minutes, total] of [[0,30,'30 min'],[1,90,'2 hr 30 min'],['','','0 min']]) {
    const html=render('AssignServiceForm',{form:{required_hours:hours,required_minutes:minutes}})
    assert.match(html,/Required service time/)
    assert.match(html,/Enter hours, minutes, or both/)
    assert.match(html,new RegExp(`Total required time: <strong>${total}</strong>`))
    for (const name of ['required_hours','required_minutes']) {
      const input=html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))[0]
      assert.match(input,/aria-describedby="assign-duration-help"/)
      assert.match(input,/type="text"/)
      assert.match(input,/inputMode="numeric"/i)
      assert.match(input,/pattern="\[0-9\]\+"/)
    }
    assert.match(html,/type="button"[^>]*data-modal-dismiss="true"[^>]*>Cancel/)
  }
})

test('48-hour shortcut is a non-submit action whose selection follows editable duration fields', () => {
  for (const [hours, minutes, selected] of [['','',false],[48,0,true],[48,'',true],[24,30,false],[48,1,false],[48,-1,false]]) {
    const html=render('AssignServiceForm',{form:{required_hours:hours,required_minutes:minutes},busy:true})
    const button=html.match(/<button[^>]*>Use 48 hours<\/button>/)?.[0]
    assert.ok(button, '48-hour shortcut is rendered')
    assert.match(button,/type="button"/)
    assert.match(button,new RegExp(`aria-pressed="${selected}"`))
    assert.ok(html.indexOf(button)<html.indexOf('</fieldset>'), 'shortcut inherits the saving lock')
    assert.match(html,/<fieldset disabled=""/)
    assert.doesNotMatch(html.match(/<input[^>]*name="required_hours"[^>]*>/)[0],/readonly/)
  }
})

test('assignment form explains unavailable choices and locks fields and actions while saving', () => {
  const form={student_id:1,student_search:'Ana Reyes - TEST-1',violation_id:'',required_hours:1,department_id:3,department_head_id:''}
  const empty=render('AssignServiceForm',{form})
  assert.match(empty,/No open violations are available for this student/)
  assert.match(empty,/No service departments with an active Department Head are available/)
  assert.match(empty,/No active Department Head is assigned to this department/)
  assert.match(empty,/aria-describedby="assign-violation_id-help"/)
  assert.match(empty,/aria-describedby="assign-department_head_id-help"/)
  assert.match(empty,/aria-labelledby="assign-department_id-label"/)
  const busy=render('AssignServiceForm',{form,busy:true,error:'Assignment unavailable'})
  assert.match(busy,/<fieldset disabled=""/)
  assert.match(busy,/data-modal-dismiss="true" disabled=""/)
  assert.match(busy,/Saving assignment…/)
  assert.match(busy,/role="alert">Assignment unavailable/)
  assert.match(busy,/value="Ana Reyes - TEST-1"/)
})

test('QR workflow shows automatic department, duration limits and active session without another Time In', () => {
  const form={qr_code:'test-code',supervising_officer_id:9,notes:'',session_type:'FIXED',selected_duration_minutes:120}
  const result={action:'scan',server_time:new Date(start).toISOString(),student:{first_name:'Ana',last_name:'Reyes',student_number:'02000',program:'BSIT'},assignment:{id:21,department_name:'Library',required_hours:6,completed_hours:.75,remaining_hours:5.25},allowance:{available_minutes:300,completed_today_minutes:180,daily_remaining_minutes:300,day_ends_at:'2026-10-05T16:00:00Z'},available_officers:[{officer_user_id:9,first_name:'Mara',role:'DEPARTMENT_HEAD'}]}
  const props={form,result,verifiedQr:'test-code',recorder:{role:'DISCIPLINE_ADMIN'}}
  const idle=render('DepartmentQrScanner',props)
  const initial=render('DepartmentQrScanner',{...props,form:{...form,session_type:'',selected_duration_minutes:null}})
  assert.match(initial,/How long will the student serve today\?/)
  assert.doesNotMatch(initial,/aria-pressed="true"|service-large-clock/)
  assert.match(initial,/disabled="">Confirm Time In/)
  assert.match(idle,/Community Service Requirement/);assert.match(idle,/45 min/);assert.match(idle,/5 hrs 15 min/)
  assert.match(idle,/Confirm Time In/);assert.match(idle,/Open Time/);assert.match(idle,/Minimum/);assert.match(idle,/Maximum/)
  assert.doesNotMatch(idle,/name="department_id"|Select Outcome/)
  assert.match(idle,/disabled=""[^]*?6 Hours/)
  const activeResult={...result,active_session:{...active,session_type:'FIXED',selected_duration_minutes:120,credit_cutoff_at:'2026-10-05T06:00:00Z'}}
  const timedIn=render('DepartmentQrScanner',{...props,result:activeResult})
  assert.match(timedIn,/Already timed in/)
  assert.match(timedIn,/Oct 5, 2026, 9:00 AM/)
  assert.match(timedIn,/Active Service Session/);assert.match(timedIn,/Time Out/);assert.doesNotMatch(timedIn,/Confirm Time In|service-duration-tile/)
  const stale=render('DepartmentQrScanner',{...props,verifiedQr:'another-code'})
  assert.match(stale,/Waiting for student QR/);assert.doesNotMatch(stale,/Ana Reyes/)
  const noOfficer=render('DepartmentQrScanner',{...props,result:{...result,available_officers:[]}})
  assert.match(noOfficer,/No authorized officer available/);assert.match(noOfficer,/disabled="">Confirm Time In/)
  const final=render('DepartmentQrScanner',{...props,result:{...result,allowance:{...result.allowance,available_minutes:60}}})
  assert.match(final,/Final remainder/)
})

test('QR All remaining uses the exact balance and respects daily and midnight allowances', () => {
  const form={qr_code:'test-code',notes:'',session_type:'FIXED',supervising_officer_id:9}
  const result={student:{first_name:'Ana'},assignment:{id:21,department_name:'Library'},available_officers:[{officer_user_id:9}],allowance:{daily_remaining_minutes:480}}
  const scan=(remaining,available,selected=remaining,daily=480)=>render('DepartmentQrScanner',{
    form:{...form,selected_duration_minutes:selected},verifiedQr:'test-code',
    result:{...result,assignment:{...result.assignment,remaining_hours:remaining/60},allowance:{available_minutes:available,daily_remaining_minutes:daily}}
  })
  for (const [balance,label] of [[390,'6 hrs 30 min'],[90,'1 hr 30 min'],[0.6,'0.6 min'],[330.00002,'5 hrs 30 min'],[180,'3 hrs']]) {
    const html=scan(balance,balance)
    assert.match(html,new RegExp('aria-pressed="true"[^>]*><strong>All remaining</strong><small>'+label+'</small>'))
    assert.doesNotMatch(html,/disabled="">Confirm Time In/)
    assert.doesNotMatch(html,/Final remainder/)
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1])
    assert.equal(new Set(ids).size,ids.length)
  }
  for (const balance of [0,480,540]) assert.doesNotMatch(scan(balance,Math.min(balance,480)),/All remaining/)
  for (const [balance,stale] of [[420,390],[120,90]]) {
    const html=scan(balance,balance,stale)
    assert.doesNotMatch(html,/aria-pressed="true"/)
    assert.match(html,/disabled="">Confirm Time In/)
  }
  for (const [available,daily,reason] of [[300,300,"today’s remaining allowance"],[30,480,'midnight'],[0,0,'Daily Community Service Limit Reached']]) {
    const html=scan(390,available,390,daily)
    assert.match(html,/disabled=""[^>]*><strong>All remaining<\/strong><small>6 hrs 30 min<\/small>/)
    assert.match(html,new RegExp(reason))
    assert.match(html,/disabled="">Confirm Time In/)
    if (available===30) assert.match(html,/<strong>Final remainder<\/strong><small>30 min<\/small>/)
    if (available===0) {
      assert.doesNotMatch(html,/Final remainder/)
      assert.match(html,/disabled=""[^>]*><strong>Open Time/)
    }
  }
})

test('camera QR verification is automatic and Verify is reserved for manual input', () => {
  const props={form:{qr_code:'camera-code',notes:''},verifiedQr:'camera-code',result:{student:{first_name:'Ana',last_name:'Reyes'},allowance:{},available_officers:[]}}
  const camera=render('DepartmentQrScanner',{...props,inputSource:'camera'})
  assert.doesNotMatch(camera,/>Verify<\/button>/)
  assert.match(camera,/Camera scan verified automatically/)
  const pending=render('DepartmentQrScanner',{...props,inputSource:'camera',isSubmitting:true,verifiedQr:''})
  assert.match(pending,/Verifying camera scan/)
  assert.doesNotMatch(pending,/>Verify<\/button>/)
  const manual=render('DepartmentQrScanner',{...props,inputSource:'manual',verifiedQr:''})
  assert.match(manual,/>Verify<\/button>/)
})

test('violation detail separates structured incident notes and preserves totals and action permissions', () => {
  const violation = { id: 23, student_id: 1, student_name: 'Ana Reyes', student_number: '02000', status: 'OPEN', severity: 'GRAVE', violation_name: 'Major Offense - Category D', exact_offense: 'Documented offense', description: 'Handbook offense: Documented offense\nIncident details: Recorded incident note', required_service_hours: 6, completed_service_hours: 0.75, incident_date: '2026-10-05', incident_time: '16:00:00' }
  const html = render('ViolationDetailsContent', { violation, role: 'DISCIPLINE_OFFICE', canAdd: true })
  assert.match(html, /Ana Reyes/)
  assert.match(html, />Incident<\/h3>/)
  assert.equal((html.match(/Documented offense/g) || []).length, 1)
  assert.match(html, /Severity<\/dt><dd>Grave/)
  assert.match(html, />Community service<\/h3>/)
  assert.doesNotMatch(html, /Quick Actions|Hours use decimal|violation-retention-note/)
  assert.match(html, /Recorded incident note/)
  assert.doesNotMatch(html, /Handbook offense:|Incident details:/)
  assert.match(html, /45 min/)
  assert.match(html, /5 hr 15 min/)
  assert.match(html, /Major Offense - Category D/)
  assert.match(html, /Edit record/)
  const closed = render('ViolationDetailsContent', { violation: { ...violation, status:'COMPLETE' }, role:'DISCIPLINE_OFFICE', canAdd:false })
  assert.doesNotMatch(closed, /Edit record|Reopen to edit/)
  assert.match(closed, /disabled=""/)
  const reopened = render('ViolationDetailsContent', { violation: { ...violation, status:'COMPLETE' }, role:'DISCIPLINE_ADMIN', canAdd:true })
  assert.match(reopened, /Reopen to edit/)
  const legacy = render('ViolationDetailsContent', { violation: { ...violation, description:'Legacy incident facts', exact_offense:null } })
  assert.match(legacy, /Legacy incident facts/)
  const duplicate = render('ViolationDetailsContent', { violation: { ...violation, incident_details:' documented OFFENSE ' } })
  assert.doesNotMatch(duplicate, /Incident notes/)
  const blank = render('ViolationDetailsContent', { violation: { ...violation, description:'', incident_details:'  ' } })
  assert.doesNotMatch(blank, /Incident notes/)
})

test('audited edit history displays real transitions and credited-hour corrections without inventing staff names', () => {
  const props = { violation: { created_at:'2026-10-05T07:54:00Z' }, history:{ actions:[{ id:1, action:'INVALID_CANCEL', from_status:'OPEN', to_status:'INVALID_CANCEL', reason:'Verified duplicate', created_at:'2026-10-05T08:00:00Z', performed_by_role:'DISCIPLINE_ADMIN', performed_by_user_id:7 }], hourCorrections:[{ id:1, previous_completed_hours:0.25, new_completed_hours:1.5, created_at:'2026-10-05T08:00:00Z', reason:'Reviewed credited time', performed_by_user_id:7 }] } }
  const html = render('ViolationEditHistory', props)
  assert.match(html, /<details class="violation-edit-history">/)
  assert.match(html, /<summary tabindex="0">History<\/summary>/)
  assert.doesNotMatch(html, /<details[^>]* open/)
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

test('administrative dashboards split primary and secondary actions with compact analytics access', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
    const html = render('AdminDashboard', { role, onNavigate() {} })
    assert.doesNotMatch(html, />Graphs</)
    assert.equal((html.match(/<button/g) || []).length > 4, true)
    assert.match(html, /Offense distribution/)
    for (const label of ['Scan QR','Issue violation','Add student','Generate report']) assert.match(html,new RegExp(label))
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

test('daily-limit timer freezes while attendance still requires Time Out', () => {
  const session = {...active,session_type:'OPEN_TIME',selected_duration_minutes:null,
    completed_today_minutes:120,credit_cutoff_at:new Date(start+6*3600000).toISOString()}
  for (const hours of [6,7]) {
    const html = render('ServiceCountdown', { session, now: start+hours*3600000 })
    assert.match(html, /aria-label="Time elapsed">06:00:00<\/time>/)
    assert.match(html, /Daily time remaining <strong>00:00:00<\/strong>/)
    assert.match(html, /Daily Community Service Limit Reached — Time Out required/)
    assert.match(render('AttendanceIndicator', { sessions: [session] }), /TIME IN/)
  }
})

test('active attendance groups six columns without losing service details or actions', () => {
  const session = {...active,first_name:'Maria',last_name:'Santos',student_number:'2024-001',
    supervising_officer_first_name:'Cardo',supervising_officer_last_name:'Dalisay',supervising_officer_role:'DEPARTMENT_HEAD',
    required_hours:48,completed_hours:2+1/6,remaining_hours:45+5/6,
    session_type:'OPEN_TIME',selected_duration_minutes:null,completed_today_minutes:120,
    credit_cutoff_at:new Date(start+6*3600000).toISOString()}
  const html = render('AdminActiveAttendance', { sessions:[session] })
  assert.equal((html.match(/<th scope="col">/g)||[]).length,6)
  assert.match(html, /Department &amp; supervisor/)
  assert.match(html, /Maria Santos/)
  assert.match(html, /2024-001/)
  assert.match(html, /Library.*Cardo Dalisay.*Department Head/s)
  assert.match(html, /Time elapsed/)
  assert.match(html, /2 hr 10 min credited/)
  assert.match(html, /of 48 hr required/)
  assert.match(html, /45 hr 50 min remaining/)
  assert.match(html, /5% credited/)
  assert.match(html, /Daily Community Service Limit Reached/)
  assert.match(html, /class="attendance-actions"/)
  assert.match(html, />Time Out<\/button>/)
  assert.match(html, />View assignment<\/button>/)
  assert.match(html, /TIME IN/)
  const fixed = render('AdminActiveAttendance', { sessions:[{...session,session_type:'FIXED',selected_duration_minutes:120}] })
  assert.match(fixed, /Remaining session time/)
  assert.doesNotMatch(fixed, />Time elapsed</)
})

test('active attendance preserves loading, error and empty states', () => {
  assert.match(render('AdminActiveAttendance', { attendanceReady:false,loading:true }), /Loading active attendance…/)
  const unavailable = render('AdminActiveAttendance', { attendanceReady:false,attendanceError:'Connection lost' })
  assert.match(unavailable, /Connection lost/)
  assert.match(unavailable, /Attendance unavailable/)
  assert.doesNotMatch(unavailable, /<table/)
  assert.match(render('AdminActiveAttendance', { sessions:[] }), /No students are currently timed in/)
  assert.doesNotMatch(render('AdminActiveAttendance', { sessions:[{...active,status:'COMPLETED',time_out:new Date(start).toISOString()}] }), /<table/)
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
  assert.match(html, /Active attendance/)
  assert.match(html, /TIME IN/)
  assert.doesNotMatch(html, /TIME OUT|Ben Cruz|type="search"/)
  assert.match(html, /Ana Reyes/)
  assert.match(html, /Library/)
  assert.match(html, /Clinic/)
  assert.match(html, /Timed-in students<\/span><strong>1<\/strong>/)
  assert.equal((html.match(/class="dashboard-active-student"/g) || []).length, 1)
})

test('admin summary derives resolved cases, severity, and progress from supplied records', () => {
  const html = render('AdminDashboard', {
    role: 'DISCIPLINE_ADMIN', onNavigate() {},
    violations: ['OPEN', 'COMPLETE', 'CLEAR', 'CANCELLED', 'PENDING'].map((status, id) => ({ id, student_id: id, student_name: `Student ${id}`, status, severity: 'GRAVE', offense_indicator_level: 'GRAVE' })),
    assignments: [{ id: 1, student_id: 1, status: 'OPEN', required_hours: 10, remaining_hours: 4 }]
  })
  assert.match(html, /Resolved cases<\/span><strong>2<\/strong>/)
  assert.match(html, /Open Violations<\/span><strong>2<\/strong>/)
  assert.match(html, /severity-grave">Grave/)
  assert.match(html, /<progress value="60" max="100"/)
  assert.match(html, /<dt>Credited<\/dt><dd>6 hr/)
  assert.match(html, /<dt>Remaining<\/dt><dd>4 hr/)
  assert.equal((html.match(/aria-label="View violation /g) || []).length, 4)
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

test('admin dashboard prioritizes work and shows each recent case once for both office roles', () => {
  for (const role of ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE']) {
    const html = render('AdminDashboard', { role, onNavigate() {}, onViewViolation() {},
      violations: Array.from({length:5},(_,id)=>({id,student_name:`Case student ${id}`,exact_offense:`Unique incident ${id}`,status:'OPEN',severity:'GRAVE',offense_indicator_level:'GRAVE'})) })
    assert.match(html, /Scan QR/)
    assert.match(html, /Issue violation/)
    assert.ok(html.indexOf('Active attendance') < html.indexOf('Community service'))
    assert.ok(html.indexOf('Community service') < html.indexOf('Recent violations'))
    assert.ok(html.indexOf('Recent violations') < html.indexOf('Offense distribution'))
    assert.doesNotMatch(html, /Recent case summary|offense-donut|dashboard-attendance-totals/)
    assert.equal((html.match(/Unique incident 0/g)||[]).length,1)
    assert.equal((html.match(/aria-label="View violation /g)||[]).length,4)
    assert.doesNotMatch(html, /Unique incident 4/)
    assert.match(html, /Awaiting clearance/)
    assert.match(html, /<progress[^>]*aria-label="Grave: 5 of 5 classified cases"[^>]*value="5"[^>]*max="5"/)
  }
})

test('admin dashboard labels each session mode and keeps capped timers and active status once', () => {
  const session = {...active,session_type:'OPEN_TIME',credit_cutoff_at:'2026-10-05T07:00:00Z',cutoff_reason:'DAILY_LIMIT',server_time:'2026-10-05T08:00:00Z',completed_today_minutes:120,remaining_hours:12}
  const html=render('AdminDashboard',{role:'DISCIPLINE_ADMIN',onNavigate() {}, activeSessions:[session,{...session,id:12,session_id:12,assignment_id:22,session_type:'FIXED',selected_duration_minutes:120,expected_completion_at:'2026-10-05T03:00:00Z',department_name:'Clinic'}]})
  assert.equal((html.match(/class="dashboard-session-label">Time elapsed/g)||[]).length,1)
  assert.equal((html.match(/class="dashboard-session-label">Remaining session time/g)||[]).length,1)
  assert.equal((html.match(/<time[^>]*aria-label="Time elapsed"/g)||[]).length,1)
  assert.equal((html.match(/<time[^>]*aria-label="Remaining session time"/g)||[]).length,1)
  assert.match(html,/06:00:00/)
  assert.match(html,/Daily Community Service Limit Reached — Time Out required/)
  assert.equal((html.match(/class="dashboard-active-student"/g)||[]).length,1)
  assert.match(html,/TIME IN/)
})
