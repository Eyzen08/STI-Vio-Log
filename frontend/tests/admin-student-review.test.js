import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildStudentDirectory, filterStudentDirectory, filterAdminStudents, handbookSanctionGuidance, summarizeStudentCondition } from '../src/lib/adminStudentReview.js'

const students=[{id:1,student_number:'02000123456',first_name:'Juan',last_name:'Dela Cruz',program:'BSIT',section:'A103'},{id:2,student_number:'02000999999',first_name:'Maria',last_name:'Santos',program:'BSTM',section:'B201'}]
test('directory filters use real standing, aggregate service and preserve repeat-offense status', () => {
  const rows = buildStudentDirectory([
    { ...students[0], year_level: 2, offense_indicator_level: 'MAJOR_LEVEL' },
    { ...students[1], year_level: 1 },
    { id: 3, first_name: 'Alex', last_name: 'Cruz', academic_level: 'SENIOR_HIGH_SCHOOL', strand: 'STEM', year_level: 11 },
    { id: 4, first_name: 'Pending', last_name: 'Service' }
  ], [{ student_id: 1, status: 'OPEN', severity: 'MINOR' }, { student_id: 2, status: 'COMPLETE', severity: 'MAJOR' }], [
    { student_id: 1, status: 'OPEN', required_hours: 5, remaining_hours: 4 },
    { student_id: 1, status: 'COMPLETED', required_hours: 1, remaining_hours: 0 },
    { student_id: 4, status: 'IN_PROGRESS', required_hours: 2, remaining_hours: 1 }
  ], [{ student_id: 2, status: 'CLEARED' }, { student_id: 4, status: 'CLEARED' }]).map((row) => ({ ...row, timedIn: row.id === 1 }))
  assert.equal(rows[0].severity, 'Major-level')
  assert.deepEqual(rows[0].service, { required: 6, remaining: 4, completed: 2, percent: 33 })
  assert.deepEqual(rows.map((row) => row.clearance), ['NOT_CLEARED', 'CLEARED', 'ELIGIBLE', 'NOT_CLEARED'])
  assert.deepEqual(filterStudentDirectory(rows, { query: 'Juan Dela Cruz', program: 'BSIT', year: 'Year 2', status: 'NOT_CLEARED', tab: 'violations', severity: 'major', attendance: 'timed-in' }).map((row) => row.id), [1])
  assert.equal(filterStudentDirectory(rows, { program: 'BSIT', status: 'CLEARED' }).length, 0)
  assert.deepEqual(filterStudentDirectory(rows, { tab: 'cleared' }).map((row) => row.id), [2])
  assert.deepEqual(filterStudentDirectory(rows, { tab: 'service' }).map((row) => row.id), [1, 4])
  assert.deepEqual(filterStudentDirectory(rows, { query: 'stem', year: 'Grade 11' }).map((row) => row.id), [3])
  assert.equal(rows[2].service.required, 0)
})
test('admin student search matches number, name, program, or section',()=>{assert.deepEqual(filterAdminStudents(students,'dela').map(x=>x.id),[1]);assert.deepEqual(filterAdminStudents(students,'A103').map(x=>x.id),[1]);assert.equal(filterAdminStudents(students,'020009').length,1)})
test('student condition summarizes only that students violation history',()=>{assert.deepEqual(summarizeStudentCondition(1,[{student_id:1,status:'OPEN',required_service_hours:4,completed_service_hours:1},{student_id:1,status:'COMPLETE',required_service_hours:2,completed_service_hours:2},{student_id:2,status:'OPEN',required_service_hours:9}]),{records:[{student_id:1,status:'OPEN',required_service_hours:4,completed_service_hours:1},{student_id:1,status:'COMPLETE',required_service_hours:2,completed_service_hours:2}],total:2,open:1,resolved:1,requiredHours:4,remainingHours:3,condition:'Requires action'})})
test('handbook guidance follows category-specific repeat sequences without inventing service hours',()=>{const guidance=handbookSanctionGuidance([{code:'HANDBOOK_MINOR',name:'Minor',count:2},{code:'HANDBOOK_MAJOR_C',name:'Major C',count:1},{code:'HANDBOOK_MAJOR_D',name:'Major D',count:1}]);assert.equal(guidance[0].guidance,'Written reprimand');assert.match(guidance[1].guidance,/7-10 school days/);assert.match(guidance[2].guidance,/Exclusion or expulsion/);assert.equal(JSON.stringify(guidance).includes('service hours'),false)})
test('student record drawer uses the reference width and connects the existing case workflow', async () => {
  const [app, css, modal] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/student-record.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Modal.jsx', import.meta.url), 'utf8')
  ])
  assert.match(app, /<StudentRecordDrawer key=\{reviewedStudent.id\}/)
  assert.match(app, /onViewCase=\{\(violation\) => \{ setReviewedStudent\(null\); navigateTo\('\/admin\/violations'\); setViewingViolation\(violation\)/)
  assert.match(css, /width:min\(926px,100vw\)/)
  assert.match(css, /backdrop-filter:blur\(3px\)/)
  assert.match(css, /\.record-tabs \{ position:sticky/)
  assert.match(css, /\.record-tab-panel\[hidden\] \{ display:none/)
  assert.match(css, /@media \(max-width:620px\)/)
  assert.match(modal, /document.querySelectorAll\('\.app-modal'\)\].at\(-1\)/)
})
