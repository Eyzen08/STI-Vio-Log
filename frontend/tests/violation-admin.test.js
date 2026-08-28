import test from 'node:test'
import assert from 'node:assert/strict'
import { buildViolationPayload, offensesForType, selectedViolationType, studentIdFromSearch, studentOptionLabel } from '../src/lib/violationAdmin.js'

test('violation creation sends only staff-editable contract fields', () => {
  assert.deepEqual(buildViolationPayload({student_id:'4',violation_type_id:'2',incident_date:'2026-08-28',exact_offense:' ID misuse ',incident_details:' Used another ID ',required_service_hours:'3.5',reported_by:99,status:'CLEAR',completed_service_hours:9}), {student_id:4,violation_type_id:2,incident_date:'2026-08-28',description:'Handbook offense: ID misuse\nIncident details: Used another ID',required_service_hours:3.5})
})

test('handbook classification reveals only its exact offense choices', () => {
  const offenses = offensesForType({violation_code:'HANDBOOK_MAJOR_A'})
  assert.equal(offenses.length, 7)
  assert.match(offenses.at(-2), /Cheating/)
  assert.match(offenses.at(-1), /Other offense/)
  assert.deepEqual(offensesForType({violation_code:'UNKNOWN'}), [])
})

test('selected violation type resolves catalog metadata safely', () => {
  const type = {id:2,violation_name:'Major Offense - Category A'}
  assert.equal(selectedViolationType([type], '2'), type)
  assert.equal(selectedViolationType([type], '9'), null)
})

test('student search resolves only an exact loaded roster option', () => {
  const students = [{id:4,student_number:'02000123456',first_name:'Juan',last_name:'Dela Cruz'}]
  assert.equal(studentOptionLabel(students[0]), '02000123456 - Juan Dela Cruz')
  assert.equal(studentIdFromSearch(students, ' 02000123456 - JUAN DELA CRUZ '), 4)
  assert.equal(studentIdFromSearch(students, 'Juan'), '')
})
