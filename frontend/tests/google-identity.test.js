import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGoogleLinkPayload,
  googleButtonConfiguration,
  googleStudentLinkErrorMessage,
  googleIdentityConfiguration,
  isGoogleClientConfigured,
  readGoogleCredential,
  validateGoogleStudentLink
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

test('Google link payload contains only an existing school identity', () => {
  assert.deepEqual(buildGoogleLinkPayload({credential:'google-token',studentNumber:' 02000123456 ',firstName:' Ada ',lastName:' Lovelace ',role:'ADMIN'}), {
    credential:'google-token',student_number:'02000123456',first_name:'Ada',last_name:'Lovelace'
  })
})

test('student Google linking validates the existing school identity', () => {
  const link={studentNumber:'02000123456',firstName:'Jose Pedro',lastName:'Reyes'}
  assert.equal(validateGoogleStudentLink(link),'')
  assert.equal(validateGoogleStudentLink({...link,studentNumber:'2024-001'}),'')
  assert.match(validateGoogleStudentLink({...link,studentNumber:'student number'}),/without spaces/)
  assert.match(validateGoogleStudentLink({...link,lastName:''}),/student number/)
})

test('student-link conflicts direct the user to the Discipline Office', () => {
  const message=googleStudentLinkErrorMessage({code:'STUDENT_LINK_UNAVAILABLE',message:'Unable to link this student account'})
  assert.match(message,/matching active student account/)
  assert.match(message,/Discipline Office/)
  assert.equal(googleStudentLinkErrorMessage({code:'NETWORK',message:'Try again'}),'Try again')
})
