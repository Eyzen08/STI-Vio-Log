import test from 'node:test'
import assert from 'node:assert/strict'
import { assignmentsForStudent, summarizeServiceAssignments } from '../src/lib/adminServiceTime.js'

test('student service drawer selects and totals every assignment', () => {
  const assignments = [
    { student_id: 7, required_hours: 5, completed_hours: 2, remaining_hours: 3 },
    { student_id: 7, required_hours: 3, completed_hours: 3, remaining_hours: 0 },
    { student_id: 8, required_hours: 10, completed_hours: 1, remaining_hours: 9 }
  ]
  const selected = assignmentsForStudent(assignments, 7)
  assert.equal(selected.length, 2)
  assert.deepEqual(summarizeServiceAssignments(selected), { required: 8, completed: 5, remaining: 3, progress: 63 })
})

test('student service summary is safe for empty and legacy records', () => {
  assert.deepEqual(summarizeServiceAssignments([]), { required: 0, completed: 0, remaining: 0, progress: 0 })
  assert.deepEqual(summarizeServiceAssignments([{ required_hours: 4, remaining_hours: 1 }]), { required: 4, completed: 3, remaining: 1, progress: 75 })
})

test('cancelled assignments retain history but contribute no service obligation', () => {
  const assignments = [{ student_id: 7, status: 'INVALID_CANCELLED', required_hours: 9, completed_hours: 1, remaining_hours: 8 }, { student_id: 7, status: 'OPEN', required_hours: 2, completed_hours: 0, remaining_hours: 2 }]
  assert.equal(assignmentsForStudent(assignments, 7).length, 2)
  assert.deepEqual(summarizeServiceAssignments(assignments), { required: 2, completed: 0, remaining: 2, progress: 0 })
})
