import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommunityServiceAssignmentPayload, communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, headsForDepartment, resolveCommunityServiceStudent, serviceDepartmentOptions } from '../src/lib/communityServiceAdmin.js'

const students = [{ id: 7, student_number: '02000123456', first_name: 'Jose Pedro', last_name: 'Reyes' }]

test('community-service student search resolves an exact roster option', () => {
  const label = communityServiceStudentLabel(students[0])
  assert.equal(label, '02000123456 - Jose Pedro Reyes')
  assert.equal(resolveCommunityServiceStudent(students, label), 7)
  assert.equal(resolveCommunityServiceStudent(students, 'Jose'), '')
})

test('eligible violations belong to the selected student, are open, and are unassigned', () => {
  const violations = [
    { id: 2, student_id: 7, status: 'OPEN' },
    { id: 3, student_id: 7, status: 'RESOLVED' },
    { id: 4, student_id: 8, status: 'OPEN' },
    { id: 5, student_id: 7, status: 'OPEN' }
  ]
  assert.deepEqual(eligibleServiceViolations(violations, [{ violation_id: 5 }], 7).map(({ id }) => id), [2])
})

test('assignment payload sends only the backend-supported fields', () => {
  assert.deepEqual(buildCommunityServiceAssignmentPayload({ violation_id: '2', student_id: '7', required_hours: '4.5', department_id: '3', department_head_id: '9', completed_hours: 1, status: 'COMPLETED' }), {
    violation_id: 2, student_id: 7, required_hours: 4.5, department_id: 3, department_head_id: 9
  })
  assert.equal(communityServiceViolationLabel({ id: 2, violation_name: 'Major offense', incident_date: '2026-08-29' }), '#2 — Major offense · 2026-08-29')
})

test('department selection limits the accountable head choices', () => {
  const destinations = [{ department_id: 3, department_head_id: 9 }, { department_id: 4, department_head_id: 10 }]
  assert.deepEqual(headsForDepartment(destinations, '3'), [destinations[0]])
})

test('scanner department options deduplicate heads without accepting arbitrary departments', () => {
  const destinations = [
    { department_id: 3, department_code: 'LIBRARY', department_name: 'Library Department', department_head_id: 9 },
    { department_id: 3, department_code: 'LIBRARY', department_name: 'Library Department', department_head_id: 10 },
    { department_id: 4, department_code: 'OTHER', department_name: 'Other', department_head_id: 11 }
  ]
  assert.deepEqual(serviceDepartmentOptions(destinations), [
    { id: 3, code: 'LIBRARY', name: 'LIBRARY' },
    { id: 4, code: 'OTHER', name: 'OTHER' }
  ])
})
