import test from 'node:test'
import assert from 'node:assert/strict'
import { filterClearanceStudents, clearanceStatusLabel } from '../src/lib/clearanceDirectory.js'

const students = [
  { id: 1, student_name: 'Maria Santos', student_number: '2024-001', program: 'BSIT', qualification_status: 'AWAITING_CLEARANCE' },
  { id: 2, student_name: 'Rafael Cruz', student_number: '2024-002', strand: 'STEM', qualification_status: 'QUALIFIED', has_issued_certificate: false },
  { id: 3, student_name: 'Ana Reyes', qualification_status: 'BLOCKED', service_complete: true },
  { id: 4, student_name: 'Luis Tan', qualification_status: 'NEEDS_SERVICE' },
  { id: 5, student_name: 'Bea Lim', qualification_status: 'NO_SERVICE_REQUIRED' },
  { id: 6, student_name: 'Paolo Sy', qualification_status: 'QUALIFIED', has_issued_certificate: true },
]

test('awaiting queue contains only server-approved candidates, including when other students completed hours', () => {
  assert.deepEqual(filterClearanceStudents(students, '', 'AWAITING_CLEARANCE').map(({ id }) => id), [1])
  assert.deepEqual(filterClearanceStudents(students, 'CRUZ', 'AWAITING_CLEARANCE'), [])
})

test('directory searches names, numbers, programs and strands without changing source data', () => {
  assert.equal(filterClearanceStudents(students, '', 'ALL').length, 6)
  for (const query of ['  maria  ', '2024-001', 'bsit']) assert.equal(filterClearanceStudents(students, query, 'ALL')[0].id, 1)
  assert.equal(filterClearanceStudents(students, 'stem', 'QUALIFIED')[0].id, 2)
  assert.deepEqual(filterClearanceStudents([], '', 'ALL'), [])
  assert.equal(students.length, 6)
})

test('status copy distinguishes approval, issuance and already issued certificates', () => {
  assert.equal(clearanceStatusLabel(students[0]), 'Awaiting clearance')
  assert.equal(clearanceStatusLabel(students[1]), 'Ready for certificate')
  assert.equal(clearanceStatusLabel(students[5]), 'Certificate issued')
  assert.equal(clearanceStatusLabel(students[4]), 'No service assigned')
})
