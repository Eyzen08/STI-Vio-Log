import test from 'node:test'
import assert from 'node:assert/strict'

import { assignmentProgress, isVerifiedQr, normalizeQrValue } from '../src/lib/departmentScanner.js'

test('attendance actions require an exact verified opaque QR value', () => {
  assert.equal(isVerifiedQr(' QR-42 ', 'QR-42'), true)
  assert.equal(isVerifiedQr('QR-43', 'QR-42'), false)
  assert.equal(isVerifiedQr('', 'QR-42'), false)
  assert.equal(normalizeQrValue(42), '')
})

test('assignment progress normalizes numeric database values', () => {
  assert.deepEqual(assignmentProgress({
    required_hours: '4.00', completed_hours: '1.50', remaining_hours: '2.50'
  }), { required: 4, completed: 1.5, remaining: 2.5 })
})
