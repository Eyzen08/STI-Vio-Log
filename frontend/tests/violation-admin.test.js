import test from 'node:test'
import assert from 'node:assert/strict'
import { buildViolationPayload, buildViolationUpdatePayload, offensesForType, selectedViolationType, studentIdFromSearch, studentOptionLabel, parseViolationDescription, violationEditForm, validateViolationEditForm } from '../src/lib/violationAdmin.js'

test('violation creation sends only staff-editable contract fields', () => {
  assert.deepEqual(buildViolationPayload({student_id:'4',violation_type_id:'2',incident_date:'2026-08-28',exact_offense:' ID misuse ',incident_details:' Used another ID ',required_service_hours:'3.5',reported_by:99,status:'CLEAR',completed_service_hours:9}), {student_id:4,violation_type_id:2,incident_date:'2026-08-28',description:'Handbook offense: ID misuse\nIncident details: Used another ID'})
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

test('violation update sends editable fields and an audit reason only', () => {
  const original = { violation_type_id: 2, incident_date: '2026-08-28', required_service_hours: 3, completed_service_hours: 1, description: 'Original text' }
  const form = { ...violationEditForm(original), incident_date: '2026-08-29', incident_details: ' Updated facts ', required_service_hours: '4.5', completed_service_hours: '2', reason: ' Case review ', status: 'CLEAR', student_id: 99 }
  assert.deepEqual(buildViolationUpdatePayload(form, original), { violation_type_id: 2, incident_date: '2026-08-29', incident_time: null, description: 'Updated facts', required_service_hours: 4.5, completed_service_hours: 2, reason: 'Case review' })
})

test('hour-only saves preserve stored incident dates despite local timestamp serialization', () => {
  for (const incident_date of ['2026-10-10', '2026-10-09T16:00:00.000Z']) {
    const original = { violation_type_id: 1, incident_date, required_service_hours: 3, completed_service_hours: 0, description: 'Facts' }
    const form = { ...violationEditForm(original), completed_service_hours: '1', reason: 'Verified credited time' }
    const payload = buildViolationUpdatePayload(form, original)
    assert.equal(Object.hasOwn(payload, 'incident_date'), false)
    assert.equal(payload.completed_service_hours, 1)
    assert.equal(buildViolationUpdatePayload({ ...form, incident_date: '2026-10-11' }, original).incident_date, '2026-10-11')
  }
})

test('legacy and structured descriptions retain all incident text', () => {
  assert.deepEqual(parseViolationDescription('Handbook offense: ID misuse\nIncident details: First line\nSecond line'), { exact_offense: 'ID misuse', incident_details: 'First line\nSecond line', legacy: false })
  assert.deepEqual(parseViolationDescription('Old free text\nwith details'), { exact_offense: '', incident_details: 'Old free text\nwith details', legacy: true })
})

test('unchanged hours are omitted so attendance updates are not overwritten', () => {
  const original = { violation_type_id: 1, incident_date: '2026-08-28', required_service_hours: 3, completed_service_hours: 1, description: 'Facts' }
  const payload = buildViolationUpdatePayload({ ...violationEditForm(original), reason: 'Metadata correction' }, original)
  assert.equal(Object.hasOwn(payload, 'completed_service_hours'), false)
  assert.equal(Object.hasOwn(payload, 'required_service_hours'), false)
  assert.equal(Object.hasOwn(payload, 'department_id'), false)
  const newAssignment = buildViolationUpdatePayload({ ...violationEditForm(original), department_id: '2', department_head_id: '3', reason: 'Assign service' }, original, false)
  assert.equal(newAssignment.department_id, 2)
  assert.equal(newAssignment.department_head_id, 3)
})

test('classification changes, invalid hours, and missing destinations show field errors', () => {
  const original = { violation_type_id: 1, incident_date: '2026-08-28', required_service_hours: 0, completed_service_hours: 0, description: 'Legacy facts' }
  const types = [{ id: 1, violation_code: 'HANDBOOK_MINOR' }, { id: 2, violation_code: 'HANDBOOK_MAJOR_A' }]
  const form = { ...violationEditForm(original), violation_type_id: '2', required_service_hours: '2', completed_service_hours: '3', reason: 'Review' }
  const errors = validateViolationEditForm(form, original, types, false)
  assert.ok(errors.exact_offense); assert.ok(errors.completed_service_hours); assert.ok(errors.department_id); assert.ok(errors.department_head_id)
  const valid = { ...form, completed_service_hours: '1', exact_offense: offensesForType(types[1])[0], department_id: '1', department_head_id: '1' }
  assert.deepEqual(validateViolationEditForm(valid, original, types, false), {})
  assert.ok(validateViolationEditForm({ ...valid, required_service_hours: '1.234' }, original, types, false).required_service_hours)
})
