import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime, formatManilaDateTime, hoursToMinutes } from '../src/lib/displayFormat.js'

test('display labels format enums without changing source values or abbreviations', () => {
  const status = 'IN_PROGRESS'
  assert.equal(formatDisplayLabel(status), 'In Progress')
  assert.equal(status, 'IN_PROGRESS')
  assert.equal(formatDisplayLabel('DEPARTMENT_HEAD'), 'Department Head')
  assert.equal(formatDisplayLabel('STUDENT_ID'), 'Student ID')
  assert.equal(formatDisplayLabel('EXPORT_CSV'), 'Export CSV')
  assert.equal(formatDisplayLabel('QR_ATTENDANCE'), 'QR Attendance')
  assert.equal(formatDisplayLabel('BSCPE'), 'BSCpE')
  assert.equal(formatDisplayLabel('E_SIGNATURE_MANAGEMENT'), 'E-Signature Management')
  assert.equal(formatDisplayLabel('CUSTOM_REVIEW_STATE'), 'Custom Review State')
  assert.equal(formatDisplayLabel('', 'Unknown'), 'Unknown')
})

test('service durations use normalized hours and minutes', () => {
  assert.equal(hoursToMinutes(5.25), 315)
  assert.equal(formatDuration(0), '0 min')
  assert.equal(formatDuration(0.5), '30 min')
  assert.equal(formatDuration(1), '1 hr')
  assert.equal(formatDuration(5.25), '5 hr 15 min')
  assert.equal(formatDuration(-2), '0 min')
})

test('incident date and Manila time are readable and missing time is explicit', () => {
  assert.match(formatIncidentDateTime('2026-09-03', '14:30'), /September 3, 2026.*2:30 PM/)
  assert.equal(formatIncidentDateTime('2026-09-03', null), 'September 3, 2026 · Time not recorded')
  assert.equal(formatIncidentDateTime(null, null), 'Not recorded')
})

test('server timestamps are displayed in Asia/Manila', () => {
  assert.match(formatManilaDateTime('2026-09-03T00:30:00Z'), /Sep 3, 2026.*8:30 AM/)
  assert.equal(formatManilaDateTime('invalid', '—'), '—')
})
