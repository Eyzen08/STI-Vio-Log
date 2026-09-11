import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarInitials } from '../src/lib/avatarInitials.js'

test('uses first and last name initials for every named account', () => {
  assert.equal(avatarInitials({ first_name: 'Pedro', last_name: 'Makisig', username: '0209090909' }), 'PM')
  assert.equal(avatarInitials({ first_name: '  pedro ', last_name: ' makisig  ' }), 'PM')
})

test('uses a stable username fallback for legacy accounts without complete names', () => {
  assert.equal(avatarInitials({ first_name: 'Pedro', username: 'pmakisig' }), 'PM')
  assert.equal(avatarInitials({ username: 'x' }), 'X')
  assert.equal(avatarInitials({}), 'U')
})
