import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceProgress, nearCompletionAssignments } from '../src/lib/serviceProgress.js'

test('service percentages use the actual requirement and bound inconsistent totals', () => {
  assert.equal(serviceProgress(20, 5).percent, 75)
  assert.equal(serviceProgress(2, 1).percent, 50)
  assert.equal(serviceProgress(0, 0).percent, 0)
  assert.equal(serviceProgress(5, null).percent, 0)
  assert.equal(serviceProgress(5, -2).percent, 100)
  assert.equal(serviceProgress(5, 8).percent, 0)
})
test('near-completion list excludes completed and distant assignments and sorts remaining time', () => {
  const rows = [{ remaining_hours: 0 }, { remaining_hours: 5 }, { remaining_hours: '2' }, { remaining_hours: 0.5 }]
  assert.deepEqual(nearCompletionAssignments(rows).map((row) => row.remaining_hours), [0.5, '2'])
  assert.equal(rows[0].remaining_hours, 0)
})
