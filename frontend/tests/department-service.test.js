import test from 'node:test'
import assert from 'node:assert/strict'
import { filterDepartmentService, serviceProgress, summarizeDepartmentService } from '../src/lib/departmentService.js'

const assignments = [{ id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '02000111111', required_hours: '4', completed_hours: '1.5', remaining_hours: '2.5', status: 'IN_PROGRESS' }, { id: 2, first_name: 'Ben', last_name: 'Cruz', student_number: '02000222222', required_hours: 2, completed_hours: 2, remaining_hours: 0, status: 'COMPLETED' }]

test('department service summarizes authoritative assignment progress', () => {
  assert.deepEqual(summarizeDepartmentService(assignments), { total: 2, active: 1, completed: 1, remainingHours: 2.5 })
  assert.equal(serviceProgress(assignments[0]), 38)
})

test('department service filters by student and canonical status', () => {
  assert.deepEqual(filterDepartmentService(assignments, '22222', 'ALL').map(({ id }) => id), [2])
  assert.deepEqual(filterDepartmentService(assignments, '', 'ACTIVE').map(({ id }) => id), [1])
})
