import { useEffect, useRef, useState } from 'react'
import { googleLogin } from '../lib/api.js'
import { prepareLoginService } from '../lib/serviceStartup.js'
import {
  isGoogleClientConfigured,
  googleButtonConfiguration,
  googleIdentityConfiguration,
  loadGoogleIdentityServices,
  readGoogleCredential
} from '../lib/googleIdentity.js'


function GoogleStudentAccess({ clientId, onSession, theme = 'light' }) {
  const buttonRef = useRef(null)
  const themeRef = useRef(theme)
  const renderButtonRef = useRef(null)
  const credentialHandlerRef = useRef(null)
  const attemptTimerRef = useRef(null)
  const startupRef = useRef(null)
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
      setIsBusy(false)
      setError('Google did not return a valid sign-in response. Please try again.')
      return
    }

    setIsBusy(true)
    setError('')

    try {
      startupRef.current?.abort()
      const controller = new AbortController()
      startupRef.current = controller
      await prepareLoginService({ signal: controller.signal })
      const session = await googleLogin(nextCredential)
      if (controller.signal.aborted) return
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
        let renderedWidth, renderedTheme
        const renderButton = () => {
          const configuration = googleButtonConfiguration({ width: buttonNode.clientWidth, onClick: beginGoogleAttempt, theme: themeRef.current })
          if (configuration.width === renderedWidth && configuration.theme === renderedTheme) return
          renderedWidth = configuration.width
          renderedTheme = configuration.theme
          buttonNode.replaceChildren()
          googleIdentity.renderButton(buttonNode, configuration)
        }
        renderButtonRef.current = renderButton
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
      renderButtonRef.current = null
      clearAttemptTimer()
      if (buttonNode) buttonNode.replaceChildren()
    }
  }, [clientId])

  useEffect(() => {
    themeRef.current = theme
    renderButtonRef.current?.()
  }, [theme])

  useEffect(() => () => {
    clearAttemptTimer()
    startupRef.current?.abort()
    credentialHandlerRef.current = null
  }, [])

  if (!isGoogleClientConfigured(clientId)) return null

  return (
    <section className="google-access" aria-label="Google Sign-In">
      <div className="auth-divider" aria-hidden="true"><span>or</span></div>
      <div ref={buttonRef} className="google-button" aria-busy={isBusy} />
      <p className="auth-status account-check-status" role="status">{isBusy && <><span className="action-spinner" aria-hidden="true" />Checking your account…</>}</p>
      <p className="google-access-eligibility">For linked student accounts.</p>
      {error && <p className="auth-mobile-help">On a phone, use Chrome or Safari. If the Google window stays blank, return here and retry outside Messenger or another in-app browser.</p>}

      {error && <p className="error-message" role="alert" aria-live="polite">{error}</p>}
    </section>
  )
}

export default GoogleStudentAccess
