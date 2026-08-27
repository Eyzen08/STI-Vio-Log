function LoginPage({ form, error, isSubmitting, onChange, onSubmit }) {
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
            <h3 id="login-title">Sign in to Vio-Log</h3>
            <p>Use the account issued by your school administrator.</p>
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

        <p className="auth-help">Having trouble signing in? Contact the Discipline Office.</p>
      </div>
    </section>
  )
}

export default LoginPage
