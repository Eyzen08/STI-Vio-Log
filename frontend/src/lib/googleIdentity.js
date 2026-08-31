const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const MAX_CREDENTIAL_LENGTH = 16_384

let scriptPromise

export const isGoogleClientConfigured = (clientId) => {
  const value = typeof clientId === 'string' ? clientId.trim() : ''

  return Boolean(
    value &&
    !value.includes('<') &&
    !value.toLowerCase().includes('replace') &&
    value.endsWith('.apps.googleusercontent.com')
  )
}

export const readGoogleCredential = (response) => {
  const credential = typeof response?.credential === 'string'
    ? response.credential.trim()
    : ''

  return credential.length > 0 && credential.length <= MAX_CREDENTIAL_LENGTH
    ? credential
    : ''
}

export const googleIdentityConfiguration = ({ clientId, callback }) => ({
  client_id: String(clientId || '').trim(),
  callback,
  auto_select: false,
  cancel_on_tap_outside: false,
  itp_support: true,
  use_fedcm_for_button: true
})

export const googleButtonConfiguration = ({ width, onClick }) => ({
  type: 'standard',
  theme: 'outline',
  size: 'large',
  text: 'continue_with',
  shape: 'rectangular',
  width: Math.max(200, Math.floor(Number(width) || 0)),
  click_listener: onClick
})

export const buildGoogleLinkPayload = ({ credential, studentNumber, firstName, lastName, phoneNumber, program, section, yearLevel, guardianName, guardianRelationship, guardianPhoneNumber }) => ({
  credential,
  student_number: studentNumber.trim(),
  first_name: firstName.trim(),
  last_name: lastName.trim(),
  phone_number: phoneNumber.trim(),
  program: program.trim(),
  section: section.trim(),
  year_level: Number(yearLevel),
  guardian_name: guardianName.trim(),
  guardian_relationship: guardianRelationship.trim(),
  guardian_phone_number: guardianPhoneNumber.trim()
})

export const validateGoogleStudentRegistration = ({ studentNumber, firstName, lastName, phoneNumber, program, section, yearLevel, guardianName, guardianRelationship, guardianPhoneNumber }) => {
  const required = [firstName, lastName, phoneNumber, program, section, guardianName, guardianRelationship, guardianPhoneNumber]
  if (required.some((value) => typeof value !== 'string' || !value.trim()) || !String(yearLevel || '').trim()) {
    return 'Complete every student and parent/guardian field.'
  }
  if (!/^\S{1,50}$/u.test(String(studentNumber || '').trim())) {
    return 'Enter the school-issued Student Number without spaces.'
  }
  if (!Number.isInteger(Number(yearLevel)) || Number(yearLevel) < 1 || Number(yearLevel) > 6) {
    return 'Select a valid year level.'
  }
  if ([phoneNumber, guardianPhoneNumber].some((value) => value.trim().length < 7 || value.trim().length > 30)) {
    return 'Enter valid student and parent/guardian phone numbers.'
  }
  return ''
}

export const googleStudentLinkErrorMessage = (error) => error?.code === 'STUDENT_LINK_UNAVAILABLE'
  ? 'We could not submit this registration. Check that the Student Number and name exactly match the school record. If this Student Number or Google account was used before, ask the Discipline Office to review the pending request or clear the old Google link.'
  : error?.message || 'The student registration could not be completed.'

export const isPendingGoogleRegistration = (result) =>
  result?.pending === true &&
  result?.registration?.status === 'PENDING' &&
  Number.isInteger(Number(result?.registration?.id)) &&
  Number(result.registration.id) > 0

export const loadGoogleIdentityServices = ({
  windowObject = window,
  documentObject = document
} = {}) => {
  if (windowObject.google?.accounts?.id) {
    return Promise.resolve(windowObject.google.accounts.id)
  }

  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = documentObject.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`)
    const script = existing || documentObject.createElement('script')

    const finish = () => {
      if (windowObject.google?.accounts?.id) {
        resolve(windowObject.google.accounts.id)
      } else {
        reject(new Error('Google sign-in is temporarily unavailable.'))
      }
    }

    const fail = () => reject(new Error('Google sign-in could not be loaded. Try again later.'))

    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', fail, { once: true })

    if (!existing) {
      script.src = GOOGLE_SCRIPT_URL
      script.async = true
      script.defer = true
      documentObject.head.appendChild(script)
    }
  }).catch((error) => {
    scriptPromise = undefined
    throw error
  })

  return scriptPromise
}
