import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

export default function StudentPasswordAccess({ routePath, onNavigate, draft, onDraftChange, onClearDraft }) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const update=(values)=>onDraftChange({...draft,...values})
  const request=async(action)=>{setBusy(true);setError('');try{await action()}catch(e){setError(e.message)}finally{setBusy(false)}}

  const forgot=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:draft.identifier})});update({message:data.message});onNavigate('/reset-password/verify')})}
  const verifyReset=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:draft.identifier,code:draft.code})});update({resetToken:data.reset_token,code:''});onNavigate('/reset-password/new')})}
  const reset=(event)=>{event.preventDefault();request(async()=>{if(!passwordIsStrong(draft.newPassword))throw new Error('Complete all password requirements.');if(draft.newPassword!==draft.confirmPassword)throw new Error('Password confirmation does not match.');await apiRequest('/api/auth/student/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_token:draft.resetToken,new_password:draft.newPassword,confirm_password:draft.confirmPassword})});onClearDraft();onNavigate('/login')})}
  const startAgain=()=>{onClearDraft();onNavigate('/forgot-password')}

  if(routePath==='/forgot-password')return <form className="login-form" onSubmit={forgot}><h3>Forgot Password</h3><p>Enter your Student Number or registered email. We will send a code if an active account matches.</p><label>Student Number or Email<input value={draft.identifier} onChange={e=>update({identifier:e.target.value})} required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}{draft.message&&<p className="success-message" role="status">{draft.message}</p>}<button disabled={busy}>{busy?'Sending…':'Send verification code'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')}>Back to login</button></form>
  if(routePath==='/reset-password/verify')return <form className="login-form" onSubmit={verifyReset}><h3>Verify Reset Code</h3><p>Enter the 6-digit code sent to the registered email.</p><label>Verification code<input value={draft.code} onChange={e=>update({code:e.target.value.replace(/\D/g,'').slice(0,6)})} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={startAgain}>Start again</button></form>
  return <form className="login-form" onSubmit={reset}><h3>Create New Password</h3><PasswordField id="reset-password" label="New Password" value={draft.newPassword} onChange={e=>update({newPassword:e.target.value})} disabled={busy}/><PasswordRequirements password={draft.newPassword}/><PasswordField id="reset-confirm" label="Confirm New Password" value={draft.confirmPassword} onChange={e=>update({confirmPassword:e.target.value})} disabled={busy}/>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!draft.resetToken}>{busy?'Resetting…':'Reset Password'}</button><button type="button" className="secondary-button" onClick={startAgain}>Cancel</button></form>
}
