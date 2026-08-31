import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGoogleLinkPayload,
  googleButtonConfiguration,
  googleStudentLinkErrorMessage,
  googleIdentityConfiguration,
  isGoogleClientConfigured,
  isPendingGoogleRegistration,
  readGoogleCredential,
  validateGoogleStudentRegistration
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

test('link payload contains only the school identity contract fields', () => {
  const payload = buildGoogleLinkPayload({
    credential: 'google-token',
    studentNumber: ' 02000123456 ',
    firstName: ' Ada ',
    lastName: ' Lovelace ',
    phoneNumber: ' 09171234567 ',
    program: ' BSIT ',
    section: ' A103 ',
    yearLevel: '3',
    guardianName: ' Maria Lovelace ',
    guardianRelationship: ' Mother ',
    guardianPhoneNumber: ' 09181234567 ',
    studentId: 99,
    role: 'ADMIN'
  })

  assert.deepEqual(payload, {
    credential: 'google-token',
    student_number: '02000123456',
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone_number: '09171234567',
    program: 'BSIT',
    section: 'A103',
    year_level: 3,
    guardian_name: 'Maria Lovelace',
    guardian_relationship: 'Mother',
    guardian_phone_number: '09181234567'
  })
})

test('student Google registration validates the school number before calling the API', () => {
  const registration = {
    studentNumber: '02000123456', firstName: 'Jose Pedro', lastName: 'Reyes',
    phoneNumber: '09171234567', program: 'BSIT', section: 'A303', yearLevel: '2',
    guardianName: 'Jenalin Hamsters', guardianRelationship: 'Mother', guardianPhoneNumber: '09123456774'
  }
  assert.equal(validateGoogleStudentRegistration(registration), '')
  assert.equal(validateGoogleStudentRegistration({ ...registration, studentNumber: '02064513751' }), '')
  assert.equal(validateGoogleStudentRegistration({ ...registration, studentNumber: '2024-001' }), '')
  assert.match(validateGoogleStudentRegistration({ ...registration, studentNumber: 'student number' }), /without spaces/)
  assert.match(validateGoogleStudentRegistration({ ...registration, guardianPhoneNumber: '' }), /every student/)
})

test('student-link conflicts provide a safe recovery instruction', () => {
  const message = googleStudentLinkErrorMessage({ code: 'STUDENT_LINK_UNAVAILABLE', message: 'Unable to link this student account' })
  assert.match(message, /exactly match the school record/)
  assert.match(message, /clear the old Google link/)
  assert.equal(message.includes('another student'), false)
  assert.equal(googleStudentLinkErrorMessage({ code: 'NETWORK', message: 'Try again' }), 'Try again')
})
