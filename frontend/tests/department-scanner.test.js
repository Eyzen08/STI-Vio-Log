import test from 'node:test'
import assert from 'node:assert/strict'

import { assignmentProgress, cameraUnavailableMessage, isVerifiedQr, normalizeQrValue, scannerQrBox } from '../src/lib/departmentScanner.js'

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

test('mobile scanner box remains inside small viewfinders', () => {
  assert.deepEqual(scannerQrBox(320, 240), { width: 172, height: 172 })
  assert.deepEqual(scannerQrBox(1000, 800), { width: 280, height: 280 })
})

test('camera failures provide secure-context and manual-entry guidance', () => {
  assert.equal(cameraUnavailableMessage({ secureContext: false, hasMediaDevices: true }), 'Camera scanning requires HTTPS or localhost.')
  assert.match(cameraUnavailableMessage({ secureContext: true, hasMediaDevices: false }), /manually/)
  assert.equal(cameraUnavailableMessage({ secureContext: true, hasMediaDevices: true }), '')
})
