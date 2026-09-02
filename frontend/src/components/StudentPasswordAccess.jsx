import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

const initialRegistration = { fullName:'',studentNumber:'',email:'',password:'',confirmPassword:'' }

export default function StudentPasswordAccess({ routePath, onNavigate }) {
  const [registration,setRegistration]=useState(initialRegistration)
  const [registrationId,setRegistrationId]=useState(null)
  const [identifier,setIdentifier]=useState('')
  const [code,setCode]=useState('')
  const [resetToken,setResetToken]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const request=async(action)=>{setBusy(true);setError('');setMessage('');try{await action()}catch(e){setError(e.message)}finally{setBusy(false)}}

  const register=(event)=>{event.preventDefault();request(async()=>{
    if(!/^02000\d{6}$/.test(registration.studentNumber))throw new Error('Student Number must use the format 02000XXXXXX.')
    if(!passwordIsStrong(registration.password))throw new Error('Complete all password requirements.')
    if(registration.password!==registration.confirmPassword)throw new Error('Password confirmation does not match.')
    const data=await apiRequest('/api/auth/student/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:registration.fullName,student_number:registration.studentNumber,email:registration.email,password:registration.password,confirm_password:registration.confirmPassword})})
    setRegistrationId(data.registration_id);setMessage(`A 6-digit code was sent to ${data.email}.`);onNavigate('/verify-email')
  })}
  const verifyRegistration=(event)=>{event.preventDefault();request(async()=>{await apiRequest('/api/auth/student/registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId,code})});setMessage('Email verified. You can now sign in.');setRegistration(initialRegistration);setCode('');onNavigate('/login')})}
  const resend=()=>request(async()=>{await apiRequest('/api/auth/student/registration/resend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId})});setMessage('A new code was sent. The previous code is no longer valid.')})
  const forgot=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});setMessage(data.message);onNavigate('/reset-password/verify')})}
  const verifyReset=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,code})});setResetToken(data.reset_token);setCode('');onNavigate('/reset-password/new')})}
  const reset=(event)=>{event.preventDefault();request(async()=>{if(!passwordIsStrong(newPassword))throw new Error('Complete all password requirements.');if(newPassword!==confirmPassword)throw new Error('Password confirmation does not match.');await apiRequest('/api/auth/student/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_token:resetToken,new_password:newPassword,confirm_password:confirmPassword})});setMessage('Password reset successfully. Sign in with your new password.');setNewPassword('');setConfirmPassword('');onNavigate('/login')})}

  if(routePath==='/register')return <form className="login-form" onSubmit={register}><h3>Create Student Account</h3><p>Register using your school identity. Your role is assigned securely by the system.</p>
    <label>Full Name<input value={registration.fullName} onChange={e=>setRegistration({...registration,fullName:e.target.value})} placeholder="Jose Pedro Reyes" required disabled={busy}/></label>
    <label>Student Number<input value={registration.studentNumber} onChange={e=>setRegistration({...registration,studentNumber:e.target.value})} placeholder="02000123456" inputMode="numeric" pattern="02000[0-9]{6}" required disabled={busy}/></label>
    <label>Email Address<input type="email" value={registration.email} onChange={e=>setRegistration({...registration,email:e.target.value})} placeholder="student@email.com" required disabled={busy}/></label>
    <PasswordField id="register-password" label="Password" value={registration.password} onChange={e=>setRegistration({...registration,password:e.target.value})} disabled={busy}/><PasswordRequirements password={registration.password}/>
    <PasswordField id="register-confirm" label="Confirm Password" value={registration.confirmPassword} onChange={e=>setRegistration({...registration,confirmPassword:e.target.value})} disabled={busy}/>
    {error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Creating account…':'Register'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')} disabled={busy}>Back to login</button></form>

  if(routePath==='/verify-email')return <form className="login-form" onSubmit={verifyRegistration}><h3>Verify Your Email</h3><p>{message||`Enter the 6-digit code sent to ${registration.email}.`}</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!registrationId}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={resend} disabled={busy||!registrationId}>Resend OTP</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/register')} disabled={busy}>Change Email</button></form>

  if(routePath==='/forgot-password')return <form className="login-form" onSubmit={forgot}><h3>Forgot Password</h3><p>Enter your Student Number or registered email. We will send a code if an active account matches.</p><label>Student Number or Email<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}{message&&<p className="success-message" role="status">{message}</p>}<button disabled={busy}>{busy?'Sending…':'Send verification code'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')}>Back to login</button></form>

  if(routePath==='/reset-password/verify')return <form className="login-form" onSubmit={verifyReset}><h3>Verify Reset Code</h3><p>Enter the 6-digit code sent to the registered email.</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Start again</button></form>

  return <form className="login-form" onSubmit={reset}><h3>Create New Password</h3><PasswordField id="reset-password" label="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy}/><PasswordRequirements password={newPassword}/><PasswordField id="reset-confirm" label="Confirm New Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={busy}/>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!resetToken}>{busy?'Resetting…':'Reset Password'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Cancel</button></form>
}
