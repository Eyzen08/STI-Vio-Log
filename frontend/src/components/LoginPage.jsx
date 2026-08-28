import GoogleStudentAccess from './GoogleStudentAccess.jsx'
import GoogleDepartmentAccess from './GoogleDepartmentAccess.jsx'

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, mode='main', onNavigate }) {
  const title = mode === 'student' ? 'Student sign in' : mode === 'department-register' ? 'Department officer signup' : mode === 'department' ? 'Department officer sign in' : 'Sign in to Vio-Log'
  const guidance = mode === 'student'
    ? 'Use Google below. First-time students confirm their Student Number and name; access starts after enrollment verification when no record exists.'
    : mode === 'department'
      ? 'Approved officers sign in with Google below. New officers must request an account first.'
      : mode === 'department-register'
        ? 'Sign in with your own school Google account, enter your officer and department details, then wait for Admin approval.'
        : 'Choose Student or Department access below. Each person must use their own school Google account.'
  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-intro">
        <span className="login-kicker">STI student services</span>
        <h2>Accountable actions. Clear progress.</h2>
        <p>
          One secure place for violation records, community-service progress,
          digital DTR, and student clearance.
        </p>

        <div className="login-assurance" aria-label="Portal capabilities">
          <span>Role-based access</span>
          <span>Auditable records</span>
          <span>Protected student data</span>
        </div>
      </div>

      <div className="login-card auth-card">
        <div className="card-header auth-card-header">
          <div>
            <span className="badge">Secure access</span>
            <h3 id="login-title">{title}</h3>
            <p>{guidance}</p>
          </div>
        </div>

        {mode !== 'department-register' && <form className="login-form" onSubmit={onSubmit}>
          <label htmlFor="username">
            Username
            <input
              id="username"
              type="text"
              name="username"
              placeholder="Enter your username"
              value={form.username}
              onChange={onChange}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              disabled={isSubmitting}
              required
              autoFocus
            />
          </label>

          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={onChange}
              autoComplete="current-password"
              disabled={isSubmitting}
              required
            />
          </label>

          {error && (
            <p className="error-message" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>}

        {mode === 'student' && <GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession} />}
        {(mode === 'department' || mode === 'department-register') && <GoogleDepartmentAccess clientId={googleClientId} mode={mode === 'department-register' ? 'register' : 'login'} onSession={onGoogleSession} onNavigate={onNavigate} />}

        {mode === 'main' && <><div className="google-link-actions auth-entry-actions"><button type="button" onClick={() => onNavigate('/student/login')}>Student Google access</button><button type="button" className="secondary-button" onClick={() => onNavigate('/department/login')}>Department Google access</button></div><div className="registration-pending auth-flow-guide"><h4>How Google access works</h4><ol><li>Choose the correct Student or Department entry.</li><li>Continue with your own school Google account.</li><li>First-time requests are verified before portal access is granted.</li></ol></div></>}
        {mode === 'department' && <button type="button" className="secondary-button" onClick={() => onNavigate('/department/register')}>Request a department account</button>}
        {mode !== 'main' && <button type="button" className="secondary-button" onClick={() => onNavigate('/login')}>Back to all sign-in options</button>}

        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
      </div>
    </section>
  )
}

export default LoginPage
