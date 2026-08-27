import { useEffect, useRef, useState } from 'react'
import { googleLink, googleLogin } from '../lib/api.js'
import {
  isGoogleClientConfigured,
  loadGoogleIdentityServices,
  readGoogleCredential
} from '../lib/googleIdentity.js'

const emptyLinkForm = { studentNumber: '', firstName: '', lastName: '' }

function GoogleStudentAccess({ clientId, onSession }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(null)
  const [credential, setCredential] = useState('')
  const [linkForm, setLinkForm] = useState(emptyLinkForm)
  const [isLinking, setIsLinking] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  credentialHandlerRef.current = async (response) => {
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
        googleIdentity.initialize({
          client_id: clientId.trim(),
          callback: (response) => credentialHandlerRef.current?.(response)
        })
        googleIdentity.renderButton(buttonNode, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: buttonNode.clientWidth
        })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

    return () => {
      active = false
      if (buttonNode) buttonNode.replaceChildren()
    }
  }, [clientId, isLinking])

  useEffect(() => () => {
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

      const session = await googleLink({ credential, ...linkForm })
      setCredential('')
      setLinkForm(emptyLinkForm)
      onSession(session)
    } catch (linkError) {
      setError(linkError.message)
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
              autoComplete="off" inputMode="numeric" disabled={isBusy} required autoFocus />
          </label>
          <label htmlFor="google-first-name">
            First name
            <input id="google-first-name" name="firstName" value={linkForm.firstName}
              onChange={(event) => setLinkForm({ ...linkForm, firstName: event.target.value })}
              autoComplete="given-name" disabled={isBusy} required />
          </label>
          <label htmlFor="google-last-name">
            Last name
            <input id="google-last-name" name="lastName" value={linkForm.lastName}
              onChange={(event) => setLinkForm({ ...linkForm, lastName: event.target.value })}
              autoComplete="family-name" disabled={isBusy} required />
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
