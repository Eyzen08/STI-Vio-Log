import test from 'node:test'
import assert from 'node:assert/strict'

import { formatMinutes, summarizeStudentService, validateDateRange } from '../src/lib/studentService.js'

test('student DTR totals derive from authoritative minute fields', () => {
  assert.deepEqual(summarizeStudentService({
    assignments: [{ required_minutes: 180, credited_minutes: 75, remaining_minutes: 105 }],
    sessions: [{ status: 'COMPLETED' }, { status: 'ACTIVE' }]
  }), { requiredMinutes: 180, creditedMinutes: 75, remainingMinutes: 105, completedSessions: 1, activeSessions: 1 })
  assert.equal(formatMinutes(135), '2h 15m')
})

test('student DTR date ranges reject inverted or malformed values', () => {
  assert.equal(validateDateRange({ from: '2026-08-28', to: '2026-08-27' }), 'From date must be on or before To date.')
  assert.equal(validateDateRange({ from: 'not-a-date', to: '' }), 'From date must use YYYY-MM-DD.')
  assert.equal(validateDateRange({ from: '2026-02-30', to: '' }), 'From date must use YYYY-MM-DD.')
  assert.equal(validateDateRange({ from: '2026-08-27', to: '2026-08-28' }), '')
})
