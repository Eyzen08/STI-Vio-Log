import { useEffect, useRef, useState } from 'react'
import { googleLink, googleLogin } from '../lib/api.js'
import {
  isGoogleClientConfigured,
  isPendingGoogleRegistration,
  googleButtonConfiguration,
  googleStudentLinkErrorMessage,
  googleIdentityConfiguration,
  loadGoogleIdentityServices,
  readGoogleCredential,
  validateGoogleStudentRegistration
} from '../lib/googleIdentity.js'

const emptyLinkForm = {
  studentNumber: '', firstName: '', lastName: '', phoneNumber: '', program: '',
  section: '', yearLevel: '', guardianName: '', guardianRelationship: '', guardianPhoneNumber: ''
}

function GoogleStudentAccess({ clientId, onSession }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(null)
  const attemptTimerRef = useRef(null)
  const [credential, setCredential] = useState('')
  const [linkForm, setLinkForm] = useState(emptyLinkForm)
  const [isLinking, setIsLinking] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingRegistration, setPendingRegistration] = useState(false)

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
      const validationError = validateGoogleStudentRegistration(linkForm)
      if (validationError) throw new Error(validationError)

      const session = await googleLink({ credential, ...linkForm })
      setCredential('')
      setLinkForm(emptyLinkForm)
      if (isPendingGoogleRegistration(session)) {
        setIsLinking(false)
        setPendingRegistration(true)
      } else {
        onSession(session)
      }
    } catch (linkError) {
      setError(googleStudentLinkErrorMessage(linkError))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="google-access" aria-labelledby="google-access-title">
      <div className="auth-divider"><span>Student access</span></div>

      {pendingRegistration ? (
        <div className="registration-pending" role="status">
          <h4 id="google-access-title">Student record review pending</h4>
          <p>Your request was submitted to the Discipline Office. You can sign in with Google after the student profile is approved.</p>
          <button type="button" className="secondary-button" onClick={() => setPendingRegistration(false)}>Back to sign in</button>
        </div>
      ) : !isLinking ? (
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
            <p>First time here? Confirm the details held by your school.</p>
          </div>

          <label htmlFor="google-student-number">
            Student number
            <input id="google-student-number" name="studentNumber" value={linkForm.studentNumber}
              onChange={(event) => setLinkForm({ ...linkForm, studentNumber: event.target.value })}
              placeholder="Enter your school-issued Student Number" autoComplete="off"
              maxLength={50} disabled={isBusy} required autoFocus />
          </label>
          <label htmlFor="google-first-name">
            First name
            <input id="google-first-name" name="firstName" value={linkForm.firstName}
              onChange={(event) => setLinkForm({ ...linkForm, firstName: event.target.value })}
              placeholder="Example: Jose Pedro" autoComplete="given-name" disabled={isBusy} required />
          </label>
          <label htmlFor="google-last-name">
            Last name
            <input id="google-last-name" name="lastName" value={linkForm.lastName}
              onChange={(event) => setLinkForm({ ...linkForm, lastName: event.target.value })}
              placeholder="Example: Reyes" autoComplete="family-name" disabled={isBusy} required />
          </label>
          <label htmlFor="google-phone-number">
            Phone number
            <input id="google-phone-number" name="phoneNumber" value={linkForm.phoneNumber}
              onChange={(event) => setLinkForm({ ...linkForm, phoneNumber: event.target.value })}
              placeholder="Example: 09171234567" autoComplete="tel" inputMode="tel" disabled={isBusy} required />
          </label>
          <label htmlFor="google-program">
            Program
            <input id="google-program" name="program" value={linkForm.program}
              onChange={(event) => setLinkForm({ ...linkForm, program: event.target.value })}
              placeholder="Example: BSIT" autoComplete="off" disabled={isBusy} required />
          </label>
          <label htmlFor="google-year-level">
            Year level
            <select id="google-year-level" name="yearLevel" value={linkForm.yearLevel}
              onChange={(event) => setLinkForm({ ...linkForm, yearLevel: event.target.value })} disabled={isBusy} required>
              <option value="">Select year level</option>
              {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label htmlFor="google-section">
            Section
            <input id="google-section" name="section" value={linkForm.section}
              onChange={(event) => setLinkForm({ ...linkForm, section: event.target.value })}
              placeholder="Example: A103" autoComplete="off" disabled={isBusy} required />
          </label>
          <label htmlFor="google-guardian-name">
            Parent/Guardian name
            <input id="google-guardian-name" name="guardianName" value={linkForm.guardianName}
              onChange={(event) => setLinkForm({ ...linkForm, guardianName: event.target.value })}
              placeholder="Example: Maria Reyes" autoComplete="name" disabled={isBusy} required />
          </label>
          <label htmlFor="google-guardian-relationship">
            Relationship
            <input id="google-guardian-relationship" name="guardianRelationship" value={linkForm.guardianRelationship}
              onChange={(event) => setLinkForm({ ...linkForm, guardianRelationship: event.target.value })}
              placeholder="Example: Mother" autoComplete="off" disabled={isBusy} required />
          </label>
          <label htmlFor="google-guardian-phone-number">
            Parent/Guardian phone number
            <input id="google-guardian-phone-number" name="guardianPhoneNumber" value={linkForm.guardianPhoneNumber}
              onChange={(event) => setLinkForm({ ...linkForm, guardianPhoneNumber: event.target.value })}
              placeholder="Example: 09181234567" autoComplete="tel" inputMode="tel" disabled={isBusy} required />
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
