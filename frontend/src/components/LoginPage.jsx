import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import PasswordField from './PasswordField.jsx'
import StudentPasswordAccess from './StudentPasswordAccess.jsx'
import buildingImage from '../assets/sti-global-city-building.jpg'
import stiLogo from '../assets/sti-logo.png'

const STUDENT_AUTH_PATHS = new Set(['/register','/verify-email','/forgot-password','/reset-password/verify','/reset-password/new'])

const ShieldIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z"/><path d="m8.8 12 2 2 4.5-5"/></svg>

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, routePath='/login', onNavigate }) {
  const studentFlow = STUDENT_AUTH_PATHS.has(routePath)
  return <section className={`login-page${studentFlow?' login-page--student-flow':''}`} aria-labelledby="login-title">
    <div className="login-intro" style={{backgroundImage:`linear-gradient(135deg, rgba(1, 36, 92, .94), rgba(0, 76, 169, .74)), url(${buildingImage})`}}>
      <div className="login-brand-mark"><img src={stiLogo} alt="STI Global City"/><span>GLOBAL CITY</span></div>
      <div className="login-intro-content"><span className="login-kicker">STI GLOBAL CITY</span><h2>A Web-Based Student Violation Monitoring and Incident Management System for STI Global City</h2><div className="login-office-title"><ShieldIcon/><strong>Discipline Office Portal</strong></div><p>Securely manage student incidents, violation records, community service, digital DTR, and clearance.</p></div>
      <div className="login-assurance" aria-label="Portal capabilities"><span>Secure Records</span><span>Role-Based Access</span><span>Protected Student Data</span></div>
    </div>
    <div className="login-form-panel">
      <div className="login-card auth-card"><div className="card-header auth-card-header"><div><span className="badge"><ShieldIcon/> Secure Access</span><h3 id="login-title">{studentFlow?'Student account security':'Welcome to Vio-Log'}</h3><p>{studentFlow?'Complete the secure student account process below.':'Sign in to continue to the Discipline Office Portal'}</p></div></div>
        {studentFlow ? <StudentPasswordAccess routePath={routePath} onNavigate={onNavigate}/> : <>
          <form className="login-form" onSubmit={onSubmit}><label htmlFor="username">Username / Student Number<input id="username" type="text" name="username" placeholder="Enter username or student number" value={form.username} onChange={onChange} autoComplete="username" autoCapitalize="none" spellCheck="false" disabled={isSubmitting} required autoFocus/></label>
            <PasswordField id="password" label="Password" placeholder="Enter your password" value={form.password} onChange={(event)=>onChange({target:{name:'password',value:event.target.value}})} disabled={isSubmitting} autoComplete="current-password"/>
            {error&&<p className="error-message" role="alert" aria-live="polite">{error}</p>}<button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting?'Signing in…':'Sign In'}</button>
          </form>
          <div className="auth-entry-actions"><button type="button" className="auth-text-link" onClick={()=>onNavigate('/forgot-password')} disabled={isSubmitting}>Forgot Password?</button><span aria-hidden="true"></span><button type="button" className="auth-text-link" onClick={()=>onNavigate('/register')}>Create Student Account</button></div>
          <details className="google-access-details"><summary>Use an existing linked Google student account</summary><GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession}/></details>
          <div className="auth-role-note"><ShieldIcon/><p>One secure login for Students, Discipline Office, Department Heads, and Administrators.</p></div>
        </>}
        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
      </div>
    </div>
  </section>
}

export default LoginPage
