import test from 'node:test'
import assert from 'node:assert/strict'
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

