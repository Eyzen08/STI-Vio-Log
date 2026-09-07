import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, formatIncidentDateTime, hoursToMinutes } from '../src/lib/displayFormat.js'

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
