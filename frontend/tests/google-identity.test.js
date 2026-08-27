import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGoogleLinkPayload,
  isGoogleClientConfigured,
  isPendingGoogleRegistration,
  readGoogleCredential
} from '../src/lib/googleIdentity.js'

test('Google sign-in is enabled only for a configured web client ID', () => {
  assert.equal(isGoogleClientConfigured('123-example.apps.googleusercontent.com'), true)
  assert.equal(isGoogleClientConfigured(''), false)
  assert.equal(isGoogleClientConfigured('<google-web-client-id>.apps.googleusercontent.com'), false)
  assert.equal(isGoogleClientConfigured('replace-me.apps.googleusercontent.com'), false)
  assert.equal(isGoogleClientConfigured('123-example'), false)
})

test('only a complete pending-registration response enters the waiting state', () => {
  assert.equal(isPendingGoogleRegistration({ pending: true, registration: { id: 7, status: 'PENDING' } }), true)
  assert.equal(isPendingGoogleRegistration({ pending: true, registration: { status: 'PENDING' } }), false)
  assert.equal(isPendingGoogleRegistration({ token: 'session', user: { role: 'STUDENT' } }), false)
})

test('Google credential responses are bounded and normalized', () => {
  assert.equal(readGoogleCredential({ credential: '  header.payload.signature  ' }), 'header.payload.signature')
  assert.equal(readGoogleCredential({}), '')
  assert.equal(readGoogleCredential({ credential: 'x'.repeat(16_385) }), '')
})

test('link payload contains only the school identity contract fields', () => {
  const payload = buildGoogleLinkPayload({
    credential: 'google-token',
    studentNumber: ' 02000123456 ',
    firstName: ' Ada ',
    lastName: ' Lovelace ',
    studentId: 99,
    role: 'ADMIN'
  })

  assert.deepEqual(payload, {
    credential: 'google-token',
    student_number: '02000123456',
    first_name: 'Ada',
    last_name: 'Lovelace'
  })
})
