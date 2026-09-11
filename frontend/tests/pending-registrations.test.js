import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formatPendingRegistrationCount, pendingRegistrationCount } from '../src/lib/pendingRegistrations.js'

test('pending account badges count only returned registration rows', () => {
  assert.equal(pendingRegistrationCount({ registrations: [{ id: 1 }] }), 1)
  assert.equal(pendingRegistrationCount({ registrations: [] }), 0)
  assert.equal(pendingRegistrationCount({ registrations: null }), 0)
})

test('pending account badges stay compact and hide zero values', () => {
  assert.equal(formatPendingRegistrationCount(1), '1')
  assert.equal(formatPendingRegistrationCount(100), '99+')
  assert.equal(formatPendingRegistrationCount(0), '')
})

test('registration review uses labeled mobile record cards', async () => {
  const source = await readFile(new URL('../src/components/GoogleRegistrationReview.jsx', import.meta.url), 'utf8')
  assert.match(source, /management-record-table registration-review-table/)
  for (const label of ['Student', 'Student number', 'Academic details', 'Email verification', 'Google link', 'Review flag', 'Submitted', 'Action']) {
    assert.match(source, new RegExp(`data-label="${label}"`))
  }
})
