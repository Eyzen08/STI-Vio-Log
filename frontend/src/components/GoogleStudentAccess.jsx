import { useEffect, useRef, useState } from 'react'
import { googleLogin } from '../lib/api.js'
import {
  isGoogleClientConfigured,
  googleButtonConfiguration,
  googleIdentityConfiguration,
  loadGoogleIdentityServices,
  readGoogleCredential
} from '../lib/googleIdentity.js'


function GoogleStudentAccess({ clientId, onSession }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(null)
  const attemptTimerRef = useRef(null)
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
      onSession(session)
    } catch (loginError) {
      setError(loginError.code === 'GOOGLE_LOGIN_FAILED' ? 'Use your Student Number and issued temporary password first. Google sign-in is available after you bind your recorded Gmail. Contact the Discipline Office for help.' : loginError.message)
    } finally {
      setIsBusy(false)
    }
  }

  useEffect(() => {
    if (!isGoogleClientConfigured(clientId)) return undefined

    let active = true
    let resizeObserver
    const buttonNode = buttonRef.current

    loadGoogleIdentityServices()
      .then((googleIdentity) => {
        if (!active || !buttonNode) return

        buttonNode.replaceChildren()
        googleIdentity.initialize(googleIdentityConfiguration({
          clientId,
          callback: (response) => credentialHandlerRef.current?.(response)
        }))
        let renderedWidth
        const renderButton = () => {
          const configuration = googleButtonConfiguration({ width: buttonNode.clientWidth, onClick: beginGoogleAttempt })
          if (configuration.width === renderedWidth) return
          renderedWidth = configuration.width
          buttonNode.replaceChildren()
          googleIdentity.renderButton(buttonNode, configuration)
        }
        renderButton()
        resizeObserver = new ResizeObserver(renderButton)
        resizeObserver.observe(buttonNode)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

    return () => {
      active = false
      resizeObserver?.disconnect()
      clearAttemptTimer()
      if (buttonNode) buttonNode.replaceChildren()
    }
  }, [clientId])

  useEffect(() => () => {
    clearAttemptTimer()
    credentialHandlerRef.current = null
  }, [])

  if (!isGoogleClientConfigured(clientId)) return null

  return (
    <section className="google-access" aria-label="Google sign-in">
      <div className="auth-divider" aria-hidden="true"><span>or</span></div>
      <div ref={buttonRef} className="google-button" aria-busy={isBusy} />
      <p className="google-access-eligibility">For linked student accounts.</p>
      {isBusy && <p className="auth-status" role="status">Checking your account…</p>}
      {error && <p className="auth-mobile-help">On a phone, use Chrome or Safari. If the Google window stays blank, return here and retry outside Messenger or another in-app browser.</p>}

      {error && <p className="error-message" role="alert" aria-live="polite">{error}</p>}
    </section>
  )
}

export default GoogleStudentAccess
