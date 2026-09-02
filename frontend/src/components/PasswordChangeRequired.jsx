import { useState } from 'react'
import { changePassword } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

export default function PasswordChangeRequired({token,onSession,onLogout}) {
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''})
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const submit=async(event)=>{event.preventDefault();setError('');if(!passwordIsStrong(form.newPassword))return setError('Complete all password requirements.');if(form.newPassword!==form.confirmPassword)return setError('New password confirmation does not match.');setBusy(true);try{const session=await changePassword({token,currentPassword:form.currentPassword,newPassword:form.newPassword});setForm({currentPassword:'',newPassword:'',confirmPassword:''});onSession(session)}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="login-page" aria-labelledby="password-change-title"><div className="login-intro"><span className="login-kicker">Account security</span><h2>Protect your school account.</h2><p>Your temporary password must be replaced before you can access portal records.</p></div><div className="login-card auth-card"><div className="card-header auth-card-header"><div><span className="badge">Required action</span><h3 id="password-change-title">Create a new password</h3><p>Use at least 8 characters with an uppercase letter, number, and symbol.</p></div></div><form className="login-form" onSubmit={submit}>
    <PasswordField id="current-password" label="Current or temporary password" value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})} disabled={busy} autoComplete="current-password" autoFocus/>
    <PasswordField id="new-password" label="New password" value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})} disabled={busy}/><PasswordRequirements password={form.newPassword}/>
    <PasswordField id="confirm-new-password" label="Confirm new password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} disabled={busy}/>
    {error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Changing password…':'Change password and continue'}</button><button type="button" className="secondary-button" onClick={onLogout} disabled={busy}>Sign out</button></form></div></section>
}
