import { useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

const initialRegistration = { firstName:'',middleName:'',lastName:'',suffix:'',studentNumber:'',email:'',phoneNumber:'',program:'',section:'',yearLevel:'',guardianName:'',guardianRelationship:'',guardianPhoneNumber:'',password:'',confirmPassword:'' }

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
    if(!/^\d{11}$/.test(registration.studentNumber))throw new Error('Student Number must contain exactly 11 digits.')
    if(!passwordIsStrong(registration.password))throw new Error('Complete all password requirements.')
    if(registration.password!==registration.confirmPassword)throw new Error('Password confirmation does not match.')
    const data=await apiRequest('/api/auth/student/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:[registration.firstName,registration.middleName,registration.lastName,registration.suffix].filter(Boolean).join(' '),first_name:registration.firstName,middle_name:registration.middleName,last_name:registration.lastName,suffix:registration.suffix,student_number:registration.studentNumber,email:registration.email,phone_number:registration.phoneNumber,program:registration.program,section:registration.section,year_level:Number(registration.yearLevel),guardian_name:registration.guardianName,guardian_relationship:registration.guardianRelationship,guardian_phone_number:registration.guardianPhoneNumber,password:registration.password,confirm_password:registration.confirmPassword})})
    setRegistrationId(data.registration_id);setMessage(`A 6-digit code was sent to ${data.email}.`);onNavigate('/verify-email')
  })}
  const verifyRegistration=(event)=>{event.preventDefault();request(async()=>{await apiRequest('/api/auth/student/registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId,code})});setMessage('Email verified. You can now sign in.');setRegistration(initialRegistration);setCode('');onNavigate('/login')})}
  const resend=()=>request(async()=>{await apiRequest('/api/auth/student/registration/resend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId})});setMessage('A new code was sent. The previous code is no longer valid.')})
  const forgot=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});setMessage(data.message);onNavigate('/reset-password/verify')})}
  const verifyReset=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,code})});setResetToken(data.reset_token);setCode('');onNavigate('/reset-password/new')})}
  const reset=(event)=>{event.preventDefault();request(async()=>{if(!passwordIsStrong(newPassword))throw new Error('Complete all password requirements.');if(newPassword!==confirmPassword)throw new Error('Password confirmation does not match.');await apiRequest('/api/auth/student/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_token:resetToken,new_password:newPassword,confirm_password:confirmPassword})});setMessage('Password reset successfully. Sign in with your new password.');setNewPassword('');setConfirmPassword('');onNavigate('/login')})}

  if(routePath==='/register')return <form className="login-form registration-profile-form" onSubmit={register}><h3>Create Student Account</h3><p>Enter your student information exactly as it appears in your school record.</p>
    <fieldset><legend>Student identity</legend><div className="registration-field-grid">
      <label>First Name<input value={registration.firstName} onChange={e=>setRegistration({...registration,firstName:e.target.value})} placeholder="Jose Pedro" autoComplete="given-name" required disabled={busy}/></label>
      <label>Middle Name (optional)<input value={registration.middleName} onChange={e=>setRegistration({...registration,middleName:e.target.value})} placeholder="Santos" autoComplete="additional-name" disabled={busy}/></label>
      <label>Last Name<input value={registration.lastName} onChange={e=>setRegistration({...registration,lastName:e.target.value})} placeholder="Reyes" autoComplete="family-name" required disabled={busy}/></label>
      <label>Suffix (optional)<input value={registration.suffix} onChange={e=>setRegistration({...registration,suffix:e.target.value})} placeholder="Jr." autoComplete="honorific-suffix" disabled={busy}/></label>
      <label>Student Number<input value={registration.studentNumber} onChange={e=>setRegistration({...registration,studentNumber:e.target.value.replace(/\D/g,'').slice(0,11)})} placeholder="01234567890" inputMode="numeric" pattern="[0-9]{11}" minLength="11" maxLength="11" title="Enter exactly 11 digits" required disabled={busy}/></label>
      <label>Email Address<input type="email" value={registration.email} onChange={e=>setRegistration({...registration,email:e.target.value})} placeholder="student@email.com" autoComplete="email" required disabled={busy}/></label>
      <label>Phone Number<input value={registration.phoneNumber} onChange={e=>setRegistration({...registration,phoneNumber:e.target.value})} placeholder="09171234567" autoComplete="tel" inputMode="tel" required disabled={busy}/></label>
      <label>Program<input value={registration.program} onChange={e=>setRegistration({...registration,program:e.target.value})} placeholder="BSIT" required disabled={busy}/></label>
      <label>Section<input value={registration.section} onChange={e=>setRegistration({...registration,section:e.target.value})} placeholder="A103" required disabled={busy}/></label>
      <label>Year Level<select value={registration.yearLevel} onChange={e=>setRegistration({...registration,yearLevel:e.target.value})} required disabled={busy}><option value="">Select year level</option>{[1,2,3,4,5,6].map(year=><option key={year} value={year}>{year}</option>)}</select></label>
    </div></fieldset>
    <fieldset><legend>Parent or guardian</legend><div className="registration-field-grid">
      <label>Parent/Guardian Name<input value={registration.guardianName} onChange={e=>setRegistration({...registration,guardianName:e.target.value})} placeholder="Maria Reyes" required disabled={busy}/></label>
      <label>Relationship<input value={registration.guardianRelationship} onChange={e=>setRegistration({...registration,guardianRelationship:e.target.value})} placeholder="Mother" required disabled={busy}/></label>
      <label>Parent/Guardian Phone<input value={registration.guardianPhoneNumber} onChange={e=>setRegistration({...registration,guardianPhoneNumber:e.target.value})} placeholder="09181234567" autoComplete="tel" inputMode="tel" required disabled={busy}/></label>
    </div></fieldset>
    <fieldset><legend>Account security</legend>
    <PasswordField id="register-password" label="Password" value={registration.password} onChange={e=>setRegistration({...registration,password:e.target.value})} disabled={busy}/><PasswordRequirements password={registration.password}/>
    <PasswordField id="register-confirm" label="Confirm Password" value={registration.confirmPassword} onChange={e=>setRegistration({...registration,confirmPassword:e.target.value})} disabled={busy}/>
    </fieldset>
    {error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Creating account…':'Register'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')} disabled={busy}>Back to login</button></form>

  if(routePath==='/verify-email')return <form className="login-form" onSubmit={verifyRegistration}><h3>Verify Your Email</h3><p>{message||`Enter the 6-digit code sent to ${registration.email}.`}</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!registrationId}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={resend} disabled={busy||!registrationId}>Resend OTP</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/register')} disabled={busy}>Change Email</button></form>

  if(routePath==='/forgot-password')return <form className="login-form" onSubmit={forgot}><h3>Forgot Password</h3><p>Enter your Student Number or registered email. We will send a code if an active account matches.</p><label>Student Number or Email<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}{message&&<p className="success-message" role="status">{message}</p>}<button disabled={busy}>{busy?'Sending…':'Send verification code'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')}>Back to login</button></form>

  if(routePath==='/reset-password/verify')return <form className="login-form" onSubmit={verifyReset}><h3>Verify Reset Code</h3><p>Enter the 6-digit code sent to the registered email.</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Start again</button></form>

  return <form className="login-form" onSubmit={reset}><h3>Create New Password</h3><PasswordField id="reset-password" label="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy}/><PasswordRequirements password={newPassword}/><PasswordField id="reset-confirm" label="Confirm New Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={busy}/>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!resetToken}>{busy?'Resetting…':'Reset Password'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Cancel</button></form>
}
