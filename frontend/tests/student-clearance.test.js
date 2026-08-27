import test from 'node:test'
import assert from 'node:assert/strict'

import { clearanceBlockers, clearanceLabel, summarizeClearance } from '../src/lib/studentClearance.js'

test('clearance summary uses live eligibility and latest academic record', () => {
  const summary = summarizeClearance({
    eligibility: { eligible: false, hasActiveViolation: true, hasPendingService: true },
    records: [{ id: 8, status: 'NOT_ELIGIBLE' }]
  })
  assert.equal(summary.status, 'NOT_ELIGIBLE')
  assert.deepEqual(clearanceBlockers(summary), [
    'Resolve all open violations.',
    'Complete all remaining community-service hours.'
  ])
})

test('eligible students without a record are shown pending approval', () => {
  const summary = summarizeClearance({ eligibility: { eligible: true, hasActiveViolation: false, hasPendingService: false }, records: [] })
  assert.equal(summary.status, 'PENDING')
  assert.deepEqual(clearanceBlockers(summary), [])
  assert.equal(clearanceLabel('CLEARED'), 'Cleared')
})
