import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDepartmentDtrQuery, departmentDtrSummary, displayDepartmentDtrDate } from '../src/lib/departmentDtr.js'

test('department DTR sends only supported filters and never a department override', () => {
  const query = new URLSearchParams(buildDepartmentDtrQuery({ from: '2026-08-01', to: '2026-08-31', student_id: ' 12 ', assignment_id: '7', department_id: '99', scanned_by: '2' }))
  assert.deepEqual(Object.fromEntries(query), { from: '2026-08-01', to: '2026-08-31', student_id: '12', assignment_id: '7' })
})

test('department DTR summarizes authoritative report totals', () => {
  assert.deepEqual(departmentDtrSummary({ total_records: '2', totals: { completed_sessions: '3', worked_minutes: '205', credited_minutes: '180' } }), { records: 2, completedSessions: 3, workedMinutes: 205, creditedMinutes: 180 })
})

test('department DTR handles absent or invalid attendance dates', () => {
  assert.equal(displayDepartmentDtrDate(null), 'Not recorded')
  assert.equal(displayDepartmentDtrDate('not-a-date'), 'Not recorded')
})
