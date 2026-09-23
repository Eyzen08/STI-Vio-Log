import { useState } from 'react'
import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import PasswordField from './PasswordField.jsx'
import StudentPasswordAccess from './StudentPasswordAccess.jsx'
import buildingImage from '../assets/sti-global-city-building-web.jpg'
import buildingNightImage from '../assets/sti-global-city-building-night.jpg'
import stiVioLogLogoTransparent from '../assets/sti-logo-web-transparent.png'
import MfaChallenge from './MfaChallenge.jsx'

const STUDENT_AUTH_PATHS = new Set(['/forgot-password','/reset-password/verify','/reset-password/new'])

const CampusIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h16M6 20V9m12 11V9M3 9l9-5 9 5M9 12v4m6-4v4"/></svg>

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, routePath='/login', onNavigate, onOpenPolicy, authDraft, onAuthDraftChange, onClearAuthDraft, mfaState, mfaDraft, onMfaDraftChange, onMfaSubmit, onMfaCancel, onMfaContinue }) {
  const studentFlow = STUDENT_AUTH_PATHS.has(routePath)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const navigate = (event, path, disabled=false) => {
    event.preventDefault()
    if (disabled) return
    onNavigate(path)
  }

  return <section className={`login-page${studentFlow?' login-page--student-flow':''}`} aria-labelledby="login-title">
    <aside className="login-intro" aria-label="STI Global City portal">
      <img className="login-campus-image login-campus-image--day" src={buildingImage} alt="STI Global City campus building" width="1200" height="825" fetchPriority="high"/>
      <img className="login-campus-image login-campus-image--night" src={buildingNightImage} alt="" width="1200" height="825" aria-hidden="true"/>
      <div className="login-brand-mark"><img src={stiVioLogLogoTransparent} alt="STI Vio-Log" width="420" height="236" fetchPriority="high"/></div>
      <div className="login-intro-content">
        <span className="login-kicker">STI Global City</span>
        <h2>Student accountability, made clearer.</h2>
        <p>Manage violations, community service, attendance, and clearance through one secure campus portal.</p>
      </div>
      <footer className="login-assurance"><small>© {new Date().getFullYear()} STI Global City</small></footer>
    </aside>
    <div className="login-form-panel">
      <div className="login-card auth-card">
        <div className="card-header auth-card-header"><div><h3 id="login-title">{studentFlow?'Student Account Security':'Sign In'}</h3><p>{studentFlow?'Complete the secure student account process below.':'Access your STI Vio-Log account'}</p></div></div>
        {mfaState ? <MfaChallenge state={mfaState} draft={mfaDraft} onDraftChange={onMfaDraftChange} error={error} busy={isSubmitting} onSubmit={onMfaSubmit} onCancel={onMfaCancel} onContinue={onMfaContinue}/> : studentFlow ? <StudentPasswordAccess routePath={routePath} onNavigate={onNavigate} draft={authDraft} onDraftChange={onAuthDraftChange} onClearDraft={onClearAuthDraft}/> : <>
          <div className="auth-trust-note"><CampusIcon/><span><strong>Official</strong> STI Global City Discipline Office Portal</span></div>
          <form className="login-form" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <label htmlFor="username">Username or student number<input id="username" type="text" name="username" placeholder="Enter your username or student number" value={form.username} onChange={onChange} autoComplete="username" autoCapitalize="none" spellCheck="false" disabled={isSubmitting} aria-invalid={Boolean(error)} aria-describedby={error?'login-error':undefined} required/></label>
            <div onKeyUp={(event)=>setCapsLockOn(event.getModifierState('CapsLock'))} onKeyDown={(event)=>setCapsLockOn(event.getModifierState('CapsLock'))}>
              <PasswordField id="password" label="Password" placeholder="Enter your password" value={form.password} onChange={(event)=>onChange({target:{name:'password',value:event.target.value}})} disabled={isSubmitting} autoComplete="current-password" invalid={Boolean(error)} describedBy={[capsLockOn?'caps-lock-note':'',error?'login-error':''].filter(Boolean).join(' ')||undefined}/>
            </div>
            {capsLockOn&&<p className="caps-lock-note" id="caps-lock-note" role="status">Caps Lock is on</p>}
            {error&&<p className="error-message" id="login-error" role="alert" aria-live="polite">{error}</p>}
            <button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting&&<span className="login-submit-spinner" aria-hidden="true"/>}{isSubmitting?'Signing in…':'Sign In'}</button>
          </form>
          <nav className="auth-entry-actions" aria-label="Account help">
            <a href="/forgot-password" onClick={(event)=>navigate(event, '/forgot-password', isSubmitting)} aria-disabled={isSubmitting}>Forgot Password?</a>
          </nav>
          <details className="google-access-details"><summary>Continue with Google</summary><GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession}/><small>For eligible linked student accounts only</small></details>
        </>}
        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
        <nav className="auth-legal-links" aria-label="Legal information">
          <a href="/privacy" onClick={(event)=>{event.preventDefault();onOpenPolicy('/privacy',routePath)}}>Privacy Policy</a>
          <span aria-hidden="true">&bull;</span>
          <a href="/terms" onClick={(event)=>{event.preventDefault();onOpenPolicy('/terms',routePath)}}>Terms of Use</a>
        </nav>
      </div>
    </div>
  </section>
}

export default LoginPage
