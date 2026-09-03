import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { assignmentProgress, attendanceState, cameraUnavailableMessage, formatServiceMinutes, isVerifiedQr, normalizeQrValue, scannerQrBox } from '../src/lib/departmentScanner.js'

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

test('verified assignment state controls time-in and time-out availability', () => {
  assert.deepEqual(attendanceState({ active_session_id: 17 }), { active: true, label: 'Currently timed in' })
  assert.deepEqual(attendanceState({ active_session_id: null }), { active: false, label: 'Not timed in' })
  assert.equal(formatServiceMinutes(150), '2 hrs 30 min')
  assert.equal(formatServiceMinutes(60), '1 hr')
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

test('all authorized staff roles use the single three-stage attendance workspace', async () => {
  const [appSource, scannerSource] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/DepartmentQrScanner.jsx', import.meta.url), 'utf8')
  ])
  assert.equal((appSource.match(/activeView === 'QR Scan'/g)||[]).length, 1)
  assert.doesNotMatch(appSource, /Legacy QR Scan/)
  assert.match(scannerSource, /Scan Student QR/)
  assert.match(scannerSource, /Student Verification/)
  assert.match(scannerSource, /Record Attendance/)
  assert.match(scannerSource, /departmentLocked/)
})
