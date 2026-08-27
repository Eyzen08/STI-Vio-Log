import test from 'node:test'
import assert from 'node:assert/strict'

import { getStudentQrPayload, qrDownloadName } from '../src/lib/studentQr.js'

test('QR payload uses only the backend-issued opaque code', () => {
  const profile = { student_number: '02000123456', qr_code: '  opaque-code-42  ', email: 'student@example.test' }
  assert.equal(getStudentQrPayload(profile), 'opaque-code-42')
})

test('missing QR values are rejected', () => {
  assert.equal(getStudentQrPayload(null), null)
  assert.equal(getStudentQrPayload({ qr_code: '   ' }), null)
  assert.equal(getStudentQrPayload({ qr_code: 123 }), null)
})

test('download filenames contain only safe characters', () => {
  assert.equal(qrDownloadName('02000/123 456'), 'sti-vio-log-02000123456-qr.png')
  assert.equal(qrDownloadName(''), 'sti-vio-log-student-qr.png')
})
