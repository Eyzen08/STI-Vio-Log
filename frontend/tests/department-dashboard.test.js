import test from 'node:test'
import assert from 'node:assert/strict'

import { formatDuration, summarizeDepartmentDtr } from '../src/lib/departmentDashboard.js'

test('department dashboard summarizes scoped DTR rows without double-counting students', () => {
  const summary = summarizeDepartmentDtr({
    totals: { completed_sessions: 5, worked_minutes: 330, credited_minutes: 300 },
    data: [
      { student_id: 4, assignment_status: 'IN_PROGRESS', remaining_hours: '1.5' },
      { student_id: 4, assignment_status: 'COMPLETED', remaining_hours: 0 },
      { student_id: 8, assignment_status: 'OPEN', remaining_hours: 2 }
    ]
  })

  assert.deepEqual(summary, {
    studentsServed: 2,
    activeAssignments: 2,
    completedSessions: 5,
    workedMinutes: 330,
    creditedMinutes: 300
  })
})

test('department duration values are displayed consistently', () => {
  assert.equal(formatDuration(0), '0m')
  assert.equal(formatDuration(45), '45m')
  assert.equal(formatDuration(60), '1h')
  assert.equal(formatDuration(135), '2h 15m')
})

test('department dashboard tolerates the empty report used during login routing', () => {
  assert.deepEqual(summarizeDepartmentDtr(null), {
    studentsServed: 0,
    activeAssignments: 0,
    completedSessions: 0,
    workedMinutes: 0,
    creditedMinutes: 0
  })
})
