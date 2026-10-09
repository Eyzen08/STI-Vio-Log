import test from 'node:test'
import assert from 'node:assert/strict'
import {

  googleButtonConfiguration,

  googleIdentityConfiguration,
  isGoogleClientConfigured,
  readGoogleCredential
} from '../src/lib/googleIdentity.js'

test('Google sign-in is enabled only for a configured web client ID', () => {
  assert.equal(isGoogleClientConfigured('123-example.apps.googleusercontent.com'), true)
  assert.equal(isGoogleClientConfigured(''), false)
  assert.equal(isGoogleClientConfigured('<google-web-client-id>.apps.googleusercontent.com'), false)
  assert.equal(isGoogleClientConfigured('replace-me.apps.googleusercontent.com'), false)
  assert.equal(isGoogleClientConfigured('123-example'), false)
})

test('Google credential responses are bounded and normalized', () => {
  assert.equal(readGoogleCredential({ credential: '  header.payload.signature  ' }), 'header.payload.signature')
  assert.equal(readGoogleCredential({}), '')
  assert.equal(readGoogleCredential({ credential: 'x'.repeat(16_385) }), '')
})

test('Google button uses mobile-safe FedCM and recovery callbacks', () => {
  const callback = () => {}
  const onClick = () => {}
  assert.deepEqual(googleIdentityConfiguration({ clientId: ' client.apps.googleusercontent.com ', callback }), {
    client_id: 'client.apps.googleusercontent.com', callback, auto_select: false,
    cancel_on_tap_outside: false, itp_support: true, use_fedcm_for_button: true
  })
  assert.deepEqual(googleButtonConfiguration({ width: 320.9, onClick }), {
    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
    shape: 'rectangular', width: 320, click_listener: onClick
  })
})
