import GoogleStudentAccess from './GoogleStudentAccess.jsx'

function LoginPage({ form, error, isSubmitting, googleClientId, onChange, onGoogleSession, onSubmit, mode='main', onNavigate }) {
  const title = mode === 'student' ? 'Student sign in' : mode === 'department' ? 'Department account sign in' : 'Sign in to Vio-Log'
  const guidance = mode === 'student'
    ? 'Use Google below. First-time students submit their Student Number and profile for Discipline Office review.'
    : mode === 'department'
      ? 'Use the username and temporary password given privately by the Discipline Office. You must change it after your first sign in.'
      : 'Students may use Google or credentials issued by the Discipline Office. Department Accounts use issued credentials.'
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

        <form className="login-form" onSubmit={onSubmit}>
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
        </form>

        {mode === 'student' && <GoogleStudentAccess clientId={googleClientId} onSession={onGoogleSession} />}
        {mode === 'main' && <><div className="google-link-actions auth-entry-actions"><button type="button" onClick={() => onNavigate('/student/login')}>Student access</button><button type="button" className="secondary-button" onClick={() => onNavigate('/department/login')}>Department Account sign in</button></div><div className="registration-pending auth-flow-guide"><h4>How access works</h4><ol><li>Students may continue with Google or use their Student Number and an issued password.</li><li>Temporary passwords must be changed after the first sign-in.</li><li>Department credentials are issued privately by the Discipline Office.</li></ol></div></>}
        {mode !== 'main' && <button type="button" className="secondary-button" onClick={() => onNavigate('/login')}>Back to all sign-in options</button>}

        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
      </div>
    </section>
  )
}

export default LoginPage
