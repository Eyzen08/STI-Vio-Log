import { useEffect, useState } from 'react'
import { totpSecondsRemaining } from '../lib/totpCountdown.js'
import OtpInput from './OtpInput.jsx'

export default function MfaChallenge({ state, error, busy, onSubmit, onCancel, onContinue, draft, onDraftChange }) {
  const [now, setNow] = useState(Date.now())
  const { code, recovery } = draft
  const setCode = (value) => onDraftChange({ ...draft, code: value })
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  if (state.recoveryCodes) return <section className="login-form" aria-live="polite">
    <header className="auth-card-header"><h1 id="login-title">Save Your Recovery Codes</h1><p>Keep these one-time codes in a password manager. They will not be shown again.</p></header>
    <ul className="mfa-recovery-codes">{state.recoveryCodes.map(value => <li key={value}><code>{value}</code></li>)}</ul>
    <button type="button" className="login-submit" onClick={onContinue}>I Saved These Codes</button>
  </section>

  const enrollment = state.mode === 'enroll'
  const period = Number(state.totp_period_seconds) || 30
  const offset = Number(state.server_time_ms || 0) - Number(state.client_time_ms || state.server_time_ms || 0)
  const remaining = totpSecondsRemaining(now + offset, period)
  const submit = (event) => { event.preventDefault(); onSubmit({ code, recovery }) }

  return <form className="login-form mfa-form" onSubmit={submit} aria-busy={busy}>
    <header className="auth-card-header">
      <h1 id="login-title">{enrollment ? 'Set Up Your Authenticator' : recovery ? 'Use a Recovery Code' : 'Two-Factor Authentication'}</h1>
      <p>{enrollment ? 'Add this setup key to your authenticator app, then enter the current six-digit code.' : recovery ? 'Enter one of the recovery codes you saved when setting up two-factor authentication.' : 'Enter the six-digit code from your authenticator app to finish signing in.'}</p>
    </header>
    {enrollment && <label>Setup Key<input readOnly value={state.secret || ''} aria-label="Authenticator Setup Key" spellCheck="false" /></label>}
    {recovery ? <label>Recovery Code<input value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" autoCapitalize="none" spellCheck="false" maxLength={32} required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'mfa-error' : undefined} autoFocus  placeholder="Enter one saved recovery code"/></label>
      : <OtpInput id="mfa-code" label="Six-Digit Code" value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} describedBy={error ? 'mfa-error' : undefined} autoFocus />}
    {!recovery && <div className="totp-countdown">
      <div><span>New code in</span><strong>{remaining}s</strong></div>
      <progress max={period} value={remaining} aria-label="Time Until a New Authenticator Code" />
    </div>}
    {error && <p className="error-message" id="mfa-error" role="alert">{error}</p>}
    <button type="submit" className="login-submit" disabled={busy || (recovery ? !code.trim() : code.length !== 6)}>{busy ? 'Verifying…' : enrollment ? 'Enable MFA' : 'Verify'}</button>
    {!enrollment && <button type="button" className="auth-text-button" onClick={() => onDraftChange({ ...draft, recovery: !recovery, code: '' })} disabled={busy}>{recovery ? 'Use Authenticator Code' : 'Use a Recovery Code'}</button>}
    <button type="button" className="auth-text-button" onClick={onCancel} disabled={busy}>Cancel</button>
  </form>
}
