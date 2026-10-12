import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'
import OtpInput from './OtpInput.jsx'

export default function StudentPasswordAccess({ routePath, onNavigate, draft, onDraftChange, onClearDraft }) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const update=(values)=>onDraftChange({...draft,...values})
  const request=async(action)=>{setBusy(true);setError('');try{await action()}catch(e){setError(e.message)}finally{setBusy(false)}}

  const forgot=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:draft.identifier})});update({message:data.message});onNavigate('/reset-password/verify')})}
  const verifyReset=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:draft.identifier,code:draft.code})});update({resetToken:data.reset_token,code:''});onNavigate('/reset-password/new')})}
  const reset=(event)=>{event.preventDefault();request(async()=>{if(!passwordIsStrong(draft.newPassword))throw new Error('Complete all password requirements.');if(draft.newPassword!==draft.confirmPassword)throw new Error('Password confirmation does not match.');await apiRequest('/api/auth/student/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_token:draft.resetToken,new_password:draft.newPassword,confirm_password:draft.confirmPassword})});onClearDraft();onNavigate('/login')})}
  const startAgain=()=>{onClearDraft();onNavigate('/forgot-password')}

  if (routePath === '/forgot-password') return <form className="login-form" onSubmit={forgot} aria-busy={busy}>
    <header className="auth-card-header"><h1 id="login-title">Forgot password?</h1><p>Enter your student number or registered email. We’ll send a code if an active account matches.</p></header>
    <label>Student number or email<input value={draft.identifier} onChange={event => update({identifier:event.target.value})} autoComplete="username" autoCapitalize="none" spellCheck="false" required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={[error ? 'password-forgot-error' : undefined, "password-identifier-help"].filter(Boolean).join(' ')} placeholder="e.g. 02000123456"/><small id="password-identifier-help">Use your student number or registered email.</small></label>
    {error && <p className="error-message" id="password-forgot-error" role="alert">{error}</p>}
    {draft.message && <p className="success-message" role="status">{draft.message}</p>}
    <button type="submit" className="login-submit" disabled={busy}>{busy ? 'Sending…' : 'Send verification code'}</button>
    <button type="button" className="auth-text-button" onClick={() => onNavigate('/login')} disabled={busy}>Back to sign in</button>
  </form>
  if (routePath === '/reset-password/verify') return <form className="login-form" onSubmit={verifyReset} aria-busy={busy}>
    <header className="auth-card-header"><h1 id="login-title">Check your email</h1><p>Enter the six-digit verification code sent to your registered email.</p></header>
    <OtpInput id="password-reset-code" label="Verification code" value={draft.code} onChange={code => update({code})} disabled={busy} invalid={Boolean(error)} describedBy={error ? 'password-reset-error' : undefined} autoFocus/>
    {error && <p className="error-message" id="password-reset-error" role="alert">{error}</p>}
    <button type="submit" className="login-submit" disabled={busy || draft.code.length !== 6}>{busy ? 'Verifying…' : 'Verify code'}</button>
    <button type="button" className="auth-text-button" onClick={startAgain} disabled={busy}>Start again</button>
  </form>
  return <form className="login-form" onSubmit={reset} aria-busy={busy}>
    <header className="auth-card-header"><h1 id="login-title">Create a new password</h1><p>Choose a strong password to keep your campus account secure.</p></header>
    <PasswordField id="reset-password" label="New password" value={draft.newPassword} onChange={event => update({newPassword:event.target.value})} disabled={busy} describedBy="reset-password-requirements" placeholder="Create a unique password"/>
    <div id="reset-password-requirements"><PasswordRequirements password={draft.newPassword}/></div>
    <PasswordField id="reset-confirm" label="Confirm new password" value={draft.confirmPassword} onChange={event => update({confirmPassword:event.target.value})} disabled={busy} invalid={Boolean(error)} describedBy={error ? 'new-password-error' : undefined} placeholder="Re-enter your new password"/>
    {error && <p className="error-message" id="new-password-error" role="alert">{error}</p>}
    <button type="submit" className="login-submit" disabled={busy || !draft.resetToken}>{busy ? 'Resetting…' : 'Reset password'}</button>
    <button type="button" className="auth-text-button" onClick={startAgain} disabled={busy}>Cancel</button>
  </form>
}
