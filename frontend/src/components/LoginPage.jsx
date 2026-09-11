import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import PasswordField from './PasswordField.jsx'
import StudentPasswordAccess from './StudentPasswordAccess.jsx'
import buildingImage from '../assets/sti-global-city-building-web.jpg'
import stiLogo from '../assets/sti-logo-web.png'

const STUDENT_AUTH_PATHS = new Set(['/register','/verify-email','/forgot-password','/reset-password/verify','/reset-password/new'])

const ShieldIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z"/><path d="m8.8 12 2 2 4.5-5"/></svg>

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, routePath='/login', onNavigate }) {
  const studentFlow = STUDENT_AUTH_PATHS.has(routePath)
  return <section className={`login-page${studentFlow?' login-page--student-flow':''}`} aria-labelledby="login-title">
    <div className="login-intro" style={{backgroundImage:`linear-gradient(180deg, rgba(0, 48, 116, .28), rgba(0, 45, 103, .9)), url(${buildingImage})`}}>
      <div className="login-brand-mark"><img src={stiLogo} alt="STI Vio-Log" width="420" height="236"/></div>
      <div className="login-intro-content"><span className="login-kicker">STI GLOBAL CITY</span><h2>STI Vio-Log</h2><p className="login-tagline">Discipline. Accountability. A Brighter Tomorrow.</p><p>A unified system for student discipline management, community service, and clearance at STI Global City.</p></div>
      <div className="login-assurance" aria-label="Portal assurance"><span>Real People. Real Opportunities.</span><small>© {new Date().getFullYear()} STI Global City</small></div>
    </div>
    <div className="login-form-panel">
      <div className="login-card auth-card"><div className="card-header auth-card-header"><div>{!studentFlow&&<span className="badge"><ShieldIcon/> Secure access</span>}<h3 id="login-title">{studentFlow?'Student account security':'Sign In'}</h3><p>{studentFlow?'Complete the secure student account process below.':'Access your STI Vio-Log account'}</p></div></div>
        {studentFlow ? <StudentPasswordAccess routePath={routePath} onNavigate={onNavigate}/> : <>
          <form className="login-form" onSubmit={onSubmit}><label htmlFor="username">Username / Student Number<input id="username" type="text" name="username" placeholder="Enter username or student number" value={form.username} onChange={onChange} autoComplete="username" autoCapitalize="none" spellCheck="false" disabled={isSubmitting} required/></label>
            <PasswordField id="password" label="Password" placeholder="Enter your password" value={form.password} onChange={(event)=>onChange({target:{name:'password',value:event.target.value}})} disabled={isSubmitting} autoComplete="current-password"/>
            {error&&<p className="error-message" role="alert" aria-live="polite">{error}</p>}<button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting?'Signing in…':'Sign In'}</button>
          </form>
          <div className="auth-entry-actions"><button type="button" className="auth-text-link" onClick={()=>onNavigate('/forgot-password')} disabled={isSubmitting}>Forgot Password?</button><span aria-hidden="true"></span><button type="button" className="auth-text-link" onClick={()=>onNavigate('/register')}>Create Student Account</button></div>
          <details className="google-access-details"><summary>Continue with Google</summary><GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession}/><small>For eligible linked student accounts only</small></details>
        </>}
        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
        <nav className="auth-legal-links" aria-label="Legal information">
          <button type="button" onClick={()=>onNavigate('/privacy')}>Privacy Policy</button>
          <span aria-hidden="true">&bull;</span>
          <button type="button" onClick={()=>onNavigate('/terms')}>Terms of Use</button>
        </nav>
      </div>
    </div>
  </section>
}

export default LoginPage
