import test from 'node:test'
import assert from 'node:assert/strict'
import { nonComplianceSortQuery, nonComplianceSummary, readableIncidentDate } from '../src/lib/departmentNonCompliance.js'

test('department non-compliance summarizes report rows', () => {
  assert.deepEqual(nonComplianceSummary({ total_non_compliant_students: '2', data: [{ open_violations: '2', pending_hours: '3.5' }, { open_violations: 1, pending_hours: 2 }] }), { students: 2, openViolations: 3, pendingHours: 5.5 })
})

test('department non-compliance sends only canonical sort values', () => {
  assert.equal(nonComplianceSortQuery('hours'), 'sort_by=hours')
  assert.equal(nonComplianceSortQuery('department_id=99'), '')
  assert.equal(readableIncidentDate('invalid'), 'Not recorded')
})
