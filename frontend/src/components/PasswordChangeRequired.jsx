import { useEffect, useRef, useState } from 'react'
import { changePassword } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import AccountSetupFrame from './AccountSetupFrame.jsx'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

export default function PasswordChangeRequired({token,user,onSession,onLogout,onOpenPolicy}) {
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''})
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const heading=useRef(null), errorRef=useRef(null), acting=useRef(false)
  const mismatch=Boolean(form.confirmPassword && form.newPassword!==form.confirmPassword)
  useEffect(()=>{heading.current?.focus()},[])
  useEffect(()=>{if(error)errorRef.current?.focus()},[error])
  const submit=async(event)=>{
    event.preventDefault()
    if(acting.current)return
    setError('')
    if(!passwordIsStrong(form.newPassword))return setError('Complete all password requirements below.')
    if(form.newPassword!==form.confirmPassword)return setError('Enter the same new password in both fields.')
    acting.current=true
    setBusy(true)
    try {
      const session=await changePassword({token,currentPassword:form.currentPassword,newPassword:form.newPassword})
      setForm({currentPassword:'',newPassword:'',confirmPassword:''})
      onSession(session)
    }catch(e){setError(e.message)}finally{acting.current=false;setBusy(false)}
  }
  return <AccountSetupFrame current={user?.onboarding_required?'PASSWORD':undefined} title="Create your own password" description="Enter the temporary password from the Discipline Office, then choose a new password to keep your account secure." headingRef={heading} busy={busy} onLogout={onLogout} onOpenPolicy={onOpenPolicy}>
    <form className="login-form setup-form" onSubmit={submit} aria-busy={busy}>
      <PasswordField id="current-password" label="Current or temporary password" value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})} disabled={busy} autoComplete="current-password"/>
      <PasswordField id="new-password" label="New password" value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})} disabled={busy} describedBy="setup-password-requirements"/>
      <div id="setup-password-requirements"><PasswordRequirements password={form.newPassword}/></div>
      <PasswordField id="confirm-new-password" label="Confirm new password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} disabled={busy} invalid={mismatch} describedBy={form.confirmPassword?'password-match':undefined}/>
      {form.confirmPassword&&<p id="password-match" className={`setup-field-note ${mismatch?'setup-field-note--error':'setup-field-note--success'}`} role="status">{mismatch?'Passwords do not match yet.':'Passwords match.'}</p>}
      {error&&<p className="error-message" ref={errorRef} tabIndex="-1" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy?'Saving password…':'Save password and continue'}</button>
    </form>
  </AccountSetupFrame>
}
