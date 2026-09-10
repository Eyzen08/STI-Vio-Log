import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { formatHours, normalizeViolation, statusLabel } from '../src/lib/studentViolations.js'

test('violation contract normalizes service totals and lifecycle history', () => {
  assert.deepEqual(normalizeViolation({
    id: 4,
    violation_name: 'Dress code',
    severity: 'MINOR',
    required_service_hours: '3.50',
    completed_service_hours: '1.25',
    remaining_service_hours: '2.25',
    history: [{ id: 1, action: 'CREATE' }]
  }), {
    id: 4,
    violation_name: 'Dress code',
    severity: 'MINOR',
    required_service_hours: 3.5,
    completed_service_hours: 1.25,
    remaining_service_hours: 2.25,
    history: [{ id: 1, action: 'CREATE' }]
  })
})

test('missing arrays and invalid hour values receive safe defaults', () => {
  const violation = normalizeViolation({ id: 9, required_service_hours: 'invalid' })
  assert.equal(violation.violation_name, 'Violation #9')
  assert.equal(violation.required_service_hours, 0)
  assert.deepEqual(violation.history, [])
  assert.equal(formatHours(2.5), '2.50')
})

test('canonical lifecycle values receive student-readable labels', () => {
  assert.equal(statusLabel('COMPLETE'), 'Completed')
  assert.equal(statusLabel('INVALID_CANCEL'), 'Invalid / cancelled')
  assert.equal(statusLabel('REOPEN'), 'Reopened')
})

test('expanded violation summaries retain readable light-surface contrast', async () => {
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.violations-page \.violation-summary\[aria-expanded="true"\][^{]*\{ background: #eaf2ff !important; color: #172033 !important; \}/)
  assert.match(css, /\.violations-page \.violation-summary-main > p \{ color: #40546d; \}/)
})
