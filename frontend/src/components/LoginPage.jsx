import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import PasswordField from './PasswordField.jsx'
import StudentPasswordAccess from './StudentPasswordAccess.jsx'

const STUDENT_AUTH_PATHS = new Set(['/register','/verify-email','/forgot-password','/reset-password/verify','/reset-password/new'])

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, routePath='/login', onNavigate }) {
  const studentFlow = STUDENT_AUTH_PATHS.has(routePath)
  return <section className="login-page" aria-labelledby="login-title">
    <div className="login-intro"><span className="login-kicker">STI student services</span><h2>Accountable actions. Clear progress.</h2><p>One secure place for violation records, community-service progress, digital DTR, and student clearance.</p><div className="login-assurance" aria-label="Portal capabilities"><span>Role-based access</span><span>Auditable records</span><span>Protected student data</span></div></div>
    <div className="login-card auth-card"><div className="card-header auth-card-header"><div><span className="badge">Secure access</span><h3 id="login-title">{studentFlow?'Student account security':'Sign in to Vio-Log'}</h3><p>{studentFlow?'Complete the secure student account process below.':'Use your assigned username or Student Number. Your account role is detected automatically.'}</p></div></div>
      {studentFlow ? <StudentPasswordAccess routePath={routePath} onNavigate={onNavigate}/> : <>
        <form className="login-form" onSubmit={onSubmit}><label htmlFor="username">Username / Student Number<input id="username" type="text" name="username" placeholder="Username or 02000123456" value={form.username} onChange={onChange} autoComplete="username" autoCapitalize="none" spellCheck="false" disabled={isSubmitting} required autoFocus/></label>
          <PasswordField id="password" label="Password" value={form.password} onChange={(event)=>onChange({target:{name:'password',value:event.target.value}})} disabled={isSubmitting} autoComplete="current-password"/>
          {error&&<p className="error-message" role="alert" aria-live="polite">{error}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting?'Signing in…':'Sign in'}</button>
          <button type="button" className="auth-text-link" onClick={()=>onNavigate('/forgot-password')} disabled={isSubmitting}>Forgot Password?</button>
        </form>
        <div className="auth-entry-actions"><button type="button" onClick={()=>onNavigate('/register')}>Create Student Account</button></div>
        <details className="google-access-details"><summary>Use an existing linked Google student account</summary><GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession}/></details>
        <div className="registration-pending auth-flow-guide"><h4>One login for every account</h4><ol><li>Students use their Student Number and password.</li><li>Admin, Discipline Office, and Department Accounts use issued usernames.</li><li>The system securely determines the correct dashboard.</li></ol></div>
      </>}
      <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
    </div>
  </section>
}

export default LoginPage
