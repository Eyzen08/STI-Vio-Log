import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeStudentDashboard } from '../src/lib/studentDashboard.js'

test('student summary counts only active requirements and totals remaining hours', () => {
  const summary = summarizeStudentDashboard({
    violations: [{ status: 'OPEN' }, { status: 'COMPLETE' }, { status: 'CLEAR' }],
    assignments: [
      { status: 'IN_PROGRESS', remaining_hours: '1.50' },
      { status: 'OPEN', remaining_hours: 2 },
      { status: 'COMPLETED', remaining_hours: 0 }
    ],
    clearanceRecords: [{ status: 'NOT_ELIGIBLE' }],
    eligibility: { hasActiveViolation: true, hasPendingService: true }
  })

  assert.deepEqual(summary, {
    standing: 'Action required',
    activeViolations: 1,
    activeAssignments: 2,
    remainingHours: 3.5,
    clearanceStatus: 'NOT_ELIGIBLE'
  })
})

test('student with no blockers is shown in good standing', () => {
  const summary = summarizeStudentDashboard({
    violations: [{ status: 'COMPLETE' }],
    assignments: [{ status: 'COMPLETED', remaining_hours: 0 }],
    eligibility: { hasActiveViolation: false, hasPendingService: false }
  })

  assert.equal(summary.standing, 'Good standing')
  assert.equal(summary.clearanceStatus, 'PENDING')
})
