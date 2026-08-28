import test from 'node:test'
import assert from 'node:assert/strict'
import { buildViolationPayload, selectedViolationType } from '../src/lib/violationAdmin.js'

test('violation creation sends only staff-editable contract fields', () => {
  assert.deepEqual(buildViolationPayload({student_id:'4',violation_type_id:'2',incident_date:'2026-08-28',description:'  ID misuse  ',required_service_hours:'3.5',reported_by:99,status:'CLEAR',completed_service_hours:9}), {student_id:4,violation_type_id:2,incident_date:'2026-08-28',description:'ID misuse',required_service_hours:3.5})
})

test('selected violation type resolves catalog metadata safely', () => {
  const type = {id:2,violation_name:'Major Offense - Category A'}
  assert.equal(selectedViolationType([type], '2'), type)
  assert.equal(selectedViolationType([type], '9'), null)
})
