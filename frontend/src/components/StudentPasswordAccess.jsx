import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import { REGISTRATION_STEP_FIELDS, REGISTRATION_STEPS, formatRegistrationInput, normalizeRegistration, registrationErrors, registrationStepIsValid } from '../lib/studentRegistration.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

const initialRegistration = { firstName:'',middleName:'',lastName:'',suffix:'',studentNumber:'',email:'',phoneNumber:'',program:'',section:'',yearLevel:'',guardianName:'',guardianRelationship:'',guardianPhoneNumber:'',password:'',confirmPassword:'' }
const reviewSections = [
  { title:'Student Identity',step:0,rows:[['First Name','firstName'],['Middle Name','middleName'],['Last Name','lastName'],['Suffix','suffix'],['Student Number','studentNumber'],['Email Address','email'],['Phone Number','phoneNumber']] },
  { title:'Academic Information',step:1,rows:[['Program','program'],['Section','section'],['Year Level','yearLevel']] },
  { title:'Parent/Guardian Information',step:2,rows:[['Guardian Full Name','guardianName'],['Relationship','guardianRelationship'],['Contact Number','guardianPhoneNumber']] },
  { title:'Account Security',step:3,rows:[['Password','password']] },
]

function FieldError({ id, message }) {
  return message ? <span id={id} className="registration-field-error" role="alert">{message}</span> : null
}

export default function StudentPasswordAccess({ routePath, onNavigate }) {
  const [registration,setRegistration]=useState(initialRegistration)
  const [registrationStep,setRegistrationStep]=useState(0)
  const [highestRegistrationStep,setHighestRegistrationStep]=useState(0)
  const [touched,setTouched]=useState({})
  const [informationConfirmed,setInformationConfirmed]=useState(false)
  const [registrationId,setRegistrationId]=useState(null)
  const [identifier,setIdentifier]=useState('')
  const [code,setCode]=useState('')
  const [resetToken,setResetToken]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const stepHeadingRef=useRef(null)
  const request=async(action)=>{setBusy(true);setError('');setMessage('');try{await action()}catch(e){setError(e.message)}finally{setBusy(false)}}

  useEffect(()=>{if(routePath==='/register')stepHeadingRef.current?.focus()},[registrationStep,routePath])

  const errors=registrationErrors(registration)
  const updateRegistration=(field,value)=>{setRegistration((current)=>({...current,[field]:formatRegistrationInput(field,value)}));setInformationConfirmed(false)}
  const touch=(field)=>setTouched((current)=>({...current,[field]:true}))
  const errorFor=(field)=>touched[field]?errors[field]:''
  const inputProps=(field)=>({value:registration[field],onChange:(event)=>updateRegistration(field,event.target.value),onBlur:()=>touch(field),'aria-invalid':Boolean(errorFor(field)),'aria-describedby':errorFor(field)?`${field}-error`:undefined,disabled:busy})
  const goNext=()=>{const fields=REGISTRATION_STEP_FIELDS[registrationStep];setTouched((current)=>({...current,...Object.fromEntries(fields.map((field)=>[field,true]))}));if(registrationStepIsValid(registration,registrationStep)){const next=Math.min(registrationStep+1,4);setRegistrationStep(next);setHighestRegistrationStep((current)=>Math.max(current,next))}}
  const goBack=()=>setRegistrationStep((current)=>Math.max(current-1,0))
  const editStep=(step)=>{setRegistrationStep(step);setInformationConfirmed(false)}

  const register=(event)=>{event.preventDefault();if(registrationStep<4){goNext();return}request(async()=>{
    if(!informationConfirmed)throw new Error('Confirm that the information is complete and accurate.')
    const values=normalizeRegistration(registration)
    if(!REGISTRATION_STEP_FIELDS.slice(0,4).every((_,step)=>registrationStepIsValid(values,step)))throw new Error('Review the form and correct the highlighted information.')
    const data=await apiRequest('/api/auth/student/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:[values.firstName,values.middleName,values.lastName,values.suffix].filter(Boolean).join(' '),first_name:values.firstName,middle_name:values.middleName,last_name:values.lastName,suffix:values.suffix,student_number:values.studentNumber,email:values.email,phone_number:values.phoneNumber,program:values.program,section:values.section,year_level:Number(values.yearLevel),guardian_name:values.guardianName,guardian_relationship:values.guardianRelationship,guardian_phone_number:values.guardianPhoneNumber,password:values.password,confirm_password:values.confirmPassword})})
    setRegistrationId(data.registration_id);setMessage(`A 6-digit code was sent to ${data.email}.`);setRegistration((current)=>({...current,password:'',confirmPassword:''}));setInformationConfirmed(false);onNavigate('/verify-email')
  })}
  const verifyRegistration=(event)=>{event.preventDefault();request(async()=>{await apiRequest('/api/auth/student/registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId,code})});setMessage('Email verified. You can now sign in.');setRegistration(initialRegistration);setRegistrationStep(0);setHighestRegistrationStep(0);setTouched({});setCode('');onNavigate('/login')})}
  const resend=()=>request(async()=>{await apiRequest('/api/auth/student/registration/resend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration_id:registrationId})});setMessage('A new code was sent. The previous code is no longer valid.')})
  const forgot=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});setMessage(data.message);onNavigate('/reset-password/verify')})}
  const verifyReset=(event)=>{event.preventDefault();request(async()=>{const data=await apiRequest('/api/auth/student/password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,code})});setResetToken(data.reset_token);setCode('');onNavigate('/reset-password/new')})}
  const reset=(event)=>{event.preventDefault();request(async()=>{if(!passwordIsStrong(newPassword))throw new Error('Complete all password requirements.');if(newPassword!==confirmPassword)throw new Error('Password confirmation does not match.');await apiRequest('/api/auth/student/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_token:resetToken,new_password:newPassword,confirm_password:confirmPassword})});setMessage('Password reset successfully. Sign in with your new password.');setNewPassword('');setConfirmPassword('');onNavigate('/login')})}

  const field=(name,label,placeholder,extra={})=><label htmlFor={`registration-${name}`}>{label}<input id={`registration-${name}`} {...inputProps(name)} placeholder={placeholder} required={extra.required!==false} {...extra}/><FieldError id={`${name}-error`} message={errorFor(name)}/></label>
  const registrationPanel=()=>{
    if(registrationStep===0)return <div className="registration-field-grid">{field('firstName','First Name','Jose Pedro',{autoComplete:'given-name'})}{field('middleName','Middle Name (optional)','Santos',{autoComplete:'additional-name',required:false})}{field('lastName','Last Name','Reyes',{autoComplete:'family-name'})}{field('suffix','Suffix (optional)','Jr.',{autoComplete:'honorific-suffix',required:false})}{field('studentNumber','Student Number','02000123456',{inputMode:'numeric',pattern:'[0-9]{11}',minLength:11,maxLength:11,title:'Enter exactly 11 digits',onChange:(event)=>updateRegistration('studentNumber',event.target.value.replace(/\D/g,'').slice(0,11))})}{field('email','Email Address','student@email.com',{type:'email',autoComplete:'email'})}{field('phoneNumber','Phone Number','09171234567',{autoComplete:'tel',inputMode:'tel'})}</div>
    if(registrationStep===1)return <div className="registration-field-grid">{field('program','Program','BSIT')}{field('section','Section','A103')}<label htmlFor="registration-yearLevel">Year Level<select id="registration-yearLevel" {...inputProps('yearLevel')} required><option value="">Select year level</option>{[1,2,3,4,5,6].map((year)=><option key={year} value={year}>{year}</option>)}</select><FieldError id="yearLevel-error" message={errorFor('yearLevel')}/></label></div>
    if(registrationStep===2)return <div className="registration-field-grid">{field('guardianName','Guardian Full Name','Maria Reyes')}{field('guardianRelationship','Relationship','Mother')}{field('guardianPhoneNumber','Parent/Guardian Contact Number','09181234567',{autoComplete:'tel',inputMode:'tel'})}</div>
    if(registrationStep===3)return <div className="registration-security-fields"><div><PasswordField id="register-password" label="Password" value={registration.password} onChange={(event)=>updateRegistration('password',event.target.value)} onBlur={()=>touch('password')} invalid={Boolean(errorFor('password'))} describedBy="password-error" disabled={busy}/><PasswordRequirements password={registration.password}/><FieldError id="password-error" message={errorFor('password')}/></div><div><PasswordField id="register-confirm" label="Confirm Password" value={registration.confirmPassword} onChange={(event)=>updateRegistration('confirmPassword',event.target.value)} onBlur={()=>touch('confirmPassword')} invalid={Boolean(errorFor('confirmPassword'))} describedBy="confirmPassword-error" disabled={busy}/><FieldError id="confirmPassword-error" message={errorFor('confirmPassword')}/></div></div>
    return <div className="registration-review">{reviewSections.map((section)=><section key={section.title} className="registration-review-section"><div className="registration-review-heading"><h5>{section.title}</h5><button type="button" className="registration-edit-button" onClick={()=>editStep(section.step)} disabled={busy}>Edit</button></div><dl>{section.rows.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{key==='password'?'Configured':registration[key]||'Not provided'}</dd></div>)}</dl></section>)}<label className="registration-confirm"><input type="checkbox" checked={informationConfirmed} onChange={(event)=>setInformationConfirmed(event.target.checked)} disabled={busy}/> I confirm that the information above is complete and accurate.</label></div>
  }

  if(routePath==='/register')return <form className="login-form registration-profile-form" onSubmit={register} noValidate><div className="registration-title"><h3>Create Student Account</h3><p>Complete each section using your official school information.</p></div><ol className="registration-stepper" aria-label="Registration progress">{REGISTRATION_STEPS.map((step,index)=><li key={step.label} className={index===registrationStep?'active':index<=highestRegistrationStep?'complete':'upcoming'} aria-current={index===registrationStep?'step':undefined}><span>{index<registrationStep||index<highestRegistrationStep?'✓':index+1}</span><small>{step.shortLabel}</small></li>)}</ol><section key={registrationStep} className="registration-step-panel" aria-labelledby="registration-step-title"><div className="registration-step-heading"><span>Step {registrationStep+1} of {REGISTRATION_STEPS.length}</span><h4 id="registration-step-title" ref={stepHeadingRef} tabIndex="-1">{REGISTRATION_STEPS[registrationStep].label}</h4></div>{registrationPanel()}</section>{error&&<p className="error-message" role="alert">{error}</p>}<div className="registration-navigation">{registrationStep>0?<button type="button" className="secondary-button" onClick={goBack} disabled={busy}>Back</button>:<button type="button" className="auth-text-link" onClick={()=>onNavigate('/login')} disabled={busy}>Back to login</button>}{registrationStep<4?<button type="button" onClick={goNext} disabled={busy||!registrationStepIsValid(registration,registrationStep)}>Next</button>:<button type="submit" disabled={busy||!informationConfirmed}>{busy?'Creating Account…':'Create Account'}</button>}</div></form>

  if(routePath==='/verify-email')return <form className="login-form" onSubmit={verifyRegistration}><h3>Verify Your Email</h3><p>{message||`Enter the 6-digit code sent to ${registration.email}.`}</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!registrationId}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={resend} disabled={busy||!registrationId}>Resend OTP</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/register')} disabled={busy}>Change Email</button></form>
  if(routePath==='/forgot-password')return <form className="login-form" onSubmit={forgot}><h3>Forgot Password</h3><p>Enter your Student Number or registered email. We will send a code if an active account matches.</p><label>Student Number or Email<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}{message&&<p className="success-message" role="status">{message}</p>}<button disabled={busy}>{busy?'Sending…':'Send verification code'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/login')}>Back to login</button></form>
  if(routePath==='/reset-password/verify')return <form className="login-form" onSubmit={verifyReset}><h3>Verify Reset Code</h3><p>Enter the 6-digit code sent to the registered email.</p><label>Verification code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Verifying…':'Verify OTP'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Start again</button></form>
  return <form className="login-form" onSubmit={reset}><h3>Create New Password</h3><PasswordField id="reset-password" label="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} disabled={busy}/><PasswordRequirements password={newPassword}/><PasswordField id="reset-confirm" label="Confirm New Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={busy}/>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy||!resetToken}>{busy?'Resetting…':'Reset Password'}</button><button type="button" className="secondary-button" onClick={()=>onNavigate('/forgot-password')}>Cancel</button></form>
}
