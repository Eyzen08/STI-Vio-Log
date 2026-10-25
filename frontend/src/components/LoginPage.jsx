import { useEffect, useRef, useState } from 'react'
import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import PasswordField from './PasswordField.jsx'
import StudentPasswordAccess from './StudentPasswordAccess.jsx'
import buildingImage from '../assets/sti-global-city-building-web.jpg'
import buildingNightImage from '../assets/sti-global-city-building-night.jpg'
import stiVioLogLogoTransparent from '../assets/sti-logo-web-transparent.png'
import MfaChallenge from './MfaChallenge.jsx'
import PortalIcon from './PortalIcon.jsx'
import ribbon from '../assets/landing-ribbon.webp'
import '../styles/public-motion.css'

const STUDENT_AUTH_PATHS = new Set(['/forgot-password','/reset-password/verify','/reset-password/new'])

const CampusIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h16M6 20V9m12 11V9M3 9l9-5 9 5M9 12v4m6-4v4"/></svg>

function LoginPage({ form, error, invalidCredentials=false, connectionProgress='', isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, routePath='/login', onNavigate, onOpenPolicy, authDraft, onAuthDraftChange, onClearAuthDraft, mfaState, mfaDraft, onMfaDraftChange, onMfaSubmit, onMfaCancel, onMfaContinue, theme='light', onToggleTheme }) {
  const studentFlow = STUDENT_AUTH_PATHS.has(routePath)
  const rootRef = useRef(null)
  const [capsLockOn, setCapsLockOn] = useState(false)
  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    import('../lib/loginMotion.js').then(({ animateLogin }) => {
      if (!disposed) cleanup = animateLogin(rootRef.current)
    }).catch(() => { /* Authentication stays visible when optional motion is unavailable. */ })
    return () => { disposed = true; cleanup() }
  }, [])
  const navigate = (event, path, disabled=false) => {
    event.preventDefault()
    if (disabled) return
    onNavigate(path)
  }

  return <section className={`login-page public-motion-surface${studentFlow?' login-page--student-flow':''}`} aria-labelledby="login-title" ref={rootRef}>
    <div className="login-utility-controls" aria-label="Display preferences">
      <button className="theme-toggle auth-theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} aria-pressed={theme === 'dark'} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} onClick={onToggleTheme}><PortalIcon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
    </div>
    <aside className="login-intro" aria-label="STI Global City Portal">
      <div className="login-campus-parallax"><div className="login-campus-drift">
      <img className="login-campus-image login-campus-image--day" src={buildingImage} alt="STI Global City campus building" width="1200" height="825" fetchPriority="high"/>
      <img className="login-campus-image login-campus-image--night" src={buildingNightImage} alt="" width="1200" height="825" aria-hidden="true"/>
      </div></div>
      <div className="login-ribbon-frame" aria-hidden="true"><img className="login-ribbon" src={ribbon} alt="" width="1200" height="800" loading="lazy" /></div>
      <div className="login-brand-mark"><img src={stiVioLogLogoTransparent} alt="STI Vio-Log" width="420" height="236" fetchPriority="high"/></div>
      <div className="login-intro-content">
        <span className="login-kicker">STI Global City</span>
        <h2><span>Discipline with purpose.</span><span>Progress with confidence.</span></h2>
        <p>Your records. Your responsibilities. Your progress.</p>
        <div className="login-journey-labels" aria-label="Portal features"><span>Records</span><i aria-hidden="true">/</i><span>Service</span><i aria-hidden="true">/</i><span>Clearance</span></div>
      </div>
      <footer className="login-assurance"><span>Discipline. Accountability. Progress.</span><small>© {new Date().getFullYear()} STI Global City</small></footer>
    </aside>
    <div className="login-form-panel">
      <div className="login-card auth-card">
        <a className="login-home-link" href="/" onClick={(event)=>navigate(event, '/', isSubmitting)} aria-disabled={isSubmitting}><PortalIcon name="arrow-right" size={16} />Back to Home</a>
        <div className="auth-trust-note"><CampusIcon/><span>STI Global City <span aria-hidden="true">/</span> Discipline Office</span></div>
        {mfaState ? <MfaChallenge state={mfaState} draft={mfaDraft} onDraftChange={onMfaDraftChange} error={error} busy={isSubmitting} onSubmit={onMfaSubmit} onCancel={onMfaCancel} onContinue={onMfaContinue}/> : studentFlow ? <StudentPasswordAccess routePath={routePath} onNavigate={onNavigate} draft={authDraft} onDraftChange={onAuthDraftChange} onClearDraft={onClearAuthDraft}/> : <>
          <header className="auth-card-header"><h1 id="login-title">Welcome Back</h1><p>Sign in to your STI Vio-Log account.</p></header>
          <form className="login-form login-form--floating" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <label className="login-floating-field" htmlFor="username"><span className="login-floating-label">Username or Student Number</span><input id="username" type="text" name="username" placeholder="e.g. 02000123456 or juan.delacruz" value={form.username} onChange={onChange} autoComplete="username" autoCapitalize="none" spellCheck="false" disabled={isSubmitting} aria-invalid={invalidCredentials} aria-describedby={error?'login-error':undefined} required/></label>
            <div className="login-password-field" onKeyUp={(event)=>setCapsLockOn(event.getModifierState('CapsLock'))} onKeyDown={(event)=>setCapsLockOn(event.getModifierState('CapsLock'))}>
              <PasswordField id="password" label="Password" labelClassName="login-floating-field" placeholder="Enter your current password" value={form.password} onChange={(event)=>onChange({target:{name:'password',value:event.target.value}})} disabled={isSubmitting} autoComplete="current-password" invalid={invalidCredentials} describedBy={[capsLockOn?'caps-lock-note':'',error?'login-error':''].filter(Boolean).join(' ')||undefined}/>
              <nav className="auth-entry-actions" aria-label="Account Help"><a href="/forgot-password" onClick={(event)=>navigate(event, '/forgot-password', isSubmitting)} aria-disabled={isSubmitting}>Forgot Password?</a></nav>
            </div>
            {connectionProgress&&<p className="auth-status" role="status" aria-live="polite">{connectionProgress}</p>}
            {capsLockOn&&<p className="caps-lock-note" id="caps-lock-note" role="status">Caps Lock is on</p>}
            {error&&<p className="error-message" id="login-error" role="alert" aria-live="polite">{error}</p>}
            <button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting&&<span className="login-submit-spinner" aria-hidden="true"/>}{isSubmitting?'Signing In…':'Sign In'}</button>
          </form>
          <GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession} theme={theme}/>
          <p className="login-first-signin-note"><strong>First Time Here?</strong> Use your student number and the temporary password issued by the Discipline Office.</p>
        </>}
        <footer className="login-footer"><p className="auth-help">Need help? Contact the Discipline Office.</p>
        <nav className="auth-legal-links" aria-label="Legal Information">
          <a href="/privacy" onClick={(event)=>{event.preventDefault();onOpenPolicy('/privacy',routePath)}}>Privacy Notice</a>
          <span aria-hidden="true">&bull;</span>
          <a href="/terms" onClick={(event)=>{event.preventDefault();onOpenPolicy('/terms',routePath)}}>Terms of Use</a>
        </nav>
        </footer>
      </div>
    </div>
  </section>
}

export default LoginPage
