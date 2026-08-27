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

export const buildGoogleLinkPayload = ({ credential, studentNumber, firstName, lastName }) => ({
  credential,
  student_number: studentNumber.trim(),
  first_name: firstName.trim(),
  last_name: lastName.trim()
})

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
