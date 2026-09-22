import { useEffect, useRef, useState } from 'react'
import { googleLink, googleLogin } from '../lib/api.js'
import {
  isGoogleClientConfigured,
  googleButtonConfiguration,
  googleStudentLinkErrorMessage,
  googleIdentityConfiguration,
  loadGoogleIdentityServices,
  readGoogleCredential,
  validateGoogleStudentLink
} from '../lib/googleIdentity.js'
import { capitalizeWords, digitsOnly, STUDENT_NUMBER_PATTERN } from '../lib/inputNormalization.js'

const emptyLinkForm = { studentNumber: '', firstName: '', lastName: '' }

function GoogleStudentAccess({ clientId, onSession }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(null)
  const attemptTimerRef = useRef(null)
  const [credential, setCredential] = useState('')
  const [linkForm, setLinkForm] = useState(emptyLinkForm)
  const [isLinking, setIsLinking] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  const clearAttemptTimer = () => {
    if (attemptTimerRef.current) window.clearTimeout(attemptTimerRef.current)
    attemptTimerRef.current = null
  }

  const beginGoogleAttempt = () => {
    clearAttemptTimer()
    setIsBusy(true)
    setError('')
    attemptTimerRef.current = window.setTimeout(() => {
      setIsBusy(false)
      setError('Google sign-in did not return to Vio-Log. Return to this page and retry in Chrome or Safari, not an in-app browser.')
    }, 30000)
  }

  credentialHandlerRef.current = async (response) => {
    clearAttemptTimer()
    const nextCredential = readGoogleCredential(response)

    if (!nextCredential) {
      setError('Google did not return a valid sign-in response. Please try again.')
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const session = await googleLogin(nextCredential)
      setCredential('')
      onSession(session)
    } catch (loginError) {
      if (loginError.code === 'GOOGLE_LOGIN_FAILED' && loginError.status === 401) {
        setCredential(nextCredential)
        setIsLinking(true)
      } else {
        setError(loginError.message)
      }
    } finally {
      setIsBusy(false)
    }
  }

  useEffect(() => {
    if (!isGoogleClientConfigured(clientId) || isLinking) return undefined

    let active = true
    const buttonNode = buttonRef.current

    loadGoogleIdentityServices()
      .then((googleIdentity) => {
        if (!active || !buttonNode) return

        buttonNode.replaceChildren()
        googleIdentity.initialize(googleIdentityConfiguration({
          clientId,
          callback: (response) => credentialHandlerRef.current?.(response)
        }))
        googleIdentity.renderButton(buttonNode, googleButtonConfiguration({
          width: buttonNode.clientWidth,
          onClick: beginGoogleAttempt
        }))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

    return () => {
      active = false
      clearAttemptTimer()
      if (buttonNode) buttonNode.replaceChildren()
    }
  }, [clientId, isLinking])

  useEffect(() => () => {
    clearAttemptTimer()
    credentialHandlerRef.current = null
  }, [])

  if (!isGoogleClientConfigured(clientId)) return null

  const cancelLinking = () => {
    setCredential('')
    setLinkForm(emptyLinkForm)
    setIsLinking(false)
    setError('')
  }

  const submitLink = async (event) => {
    event.preventDefault()
    setIsBusy(true)
    setError('')

    try {
      if (!credential) throw new Error('Your Google sign-in expired. Please start again.')
      const validationError = validateGoogleStudentLink(linkForm)
      if (validationError) throw new Error(validationError)

      const session = await googleLink({ credential, ...linkForm })
      setCredential('')
      setLinkForm(emptyLinkForm)
      onSession(session)
    } catch (linkError) {
      setError(googleStudentLinkErrorMessage(linkError))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="google-access" aria-labelledby="google-access-title">
      <div className="auth-divider"><span>Student access</span></div>

      {!isLinking ? (
        <>
          <h4 id="google-access-title">Continue with your school Google account</h4>
          <div ref={buttonRef} className="google-button" aria-busy={isBusy} />
          {isBusy && <p className="auth-status" role="status">Checking your account…</p>}
          <p className="auth-mobile-help">On a phone, use Chrome or Safari. If the Google window stays blank, return here and retry outside Messenger or another in-app browser.</p>
        </>
      ) : (
        <form className="google-link-form" onSubmit={submitLink}>
          <div>
            <h4 id="google-access-title">Link your student record</h4>
            <p>Confirm the details on the student account already created by the Discipline Office.</p>
          </div>

          <label htmlFor="google-student-number">
            Student number
            <input id="google-student-number" name="studentNumber" value={linkForm.studentNumber}
              onChange={(event) => setLinkForm({ ...linkForm, studentNumber: digitsOnly(event.target.value) })}
              placeholder="Enter your school-issued Student Number" autoComplete="off"
              inputMode="numeric" pattern={STUDENT_NUMBER_PATTERN} maxLength={11} disabled={isBusy} required autoFocus />
          </label>
          <label htmlFor="google-first-name">
            First name
            <input id="google-first-name" name="firstName" value={linkForm.firstName}
              onChange={(event) => setLinkForm({ ...linkForm, firstName: capitalizeWords(event.target.value) })}
              placeholder="Example: Jose Pedro" autoComplete="given-name" disabled={isBusy} required />
          </label>
          <label htmlFor="google-last-name">
            Last name
            <input id="google-last-name" name="lastName" value={linkForm.lastName}
              onChange={(event) => setLinkForm({ ...linkForm, lastName: capitalizeWords(event.target.value) })}
              placeholder="Example: Reyes" autoComplete="family-name" disabled={isBusy} required />
          </label>
          <div className="google-link-actions">
            <button type="submit" disabled={isBusy}>{isBusy ? 'Linking…' : 'Link and sign in'}</button>
            <button type="button" className="secondary-button" onClick={cancelLinking} disabled={isBusy}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="error-message" role="alert" aria-live="polite">{error}</p>}
    </section>
  )
}

export default GoogleStudentAccess
