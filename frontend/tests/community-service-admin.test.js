import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommunityServiceAssignmentPayload, communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, resolveCommunityServiceStudent } from '../src/lib/communityServiceAdmin.js'

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
  assert.deepEqual(buildCommunityServiceAssignmentPayload({ violation_id: '2', student_id: '7', required_hours: '4.5', completed_hours: 1, status: 'COMPLETED' }), {
    violation_id: 2, student_id: 7, required_hours: 4.5
  })
  assert.equal(communityServiceViolationLabel({ id: 2, violation_name: 'Major offense', incident_date: '2026-08-29' }), '#2 — Major offense · 2026-08-29')
})
