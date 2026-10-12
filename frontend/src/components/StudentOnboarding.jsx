import { useEffect, useRef, useState } from 'react'
import { STRANDS, yearOptions } from '../lib/studentAcademic.js'
import { completeStudentOnboarding, linkStudentGoogle, requestStudentGoogleEmail, verifyStudentGoogleEmail } from '../lib/api.js'
import { googleButtonConfiguration, googleIdentityConfiguration, isGoogleClientConfigured, loadGoogleIdentityServices, readGoogleCredential } from '../lib/googleIdentity.js'
import { normalizePhilippinePhone } from '../lib/phone.js'
import { normalizePersonName, normalizeNameSpacing, STUDENT_NAME_PATTERN } from '../lib/inputNormalization.js'
import AccountSetupFrame from './AccountSetupFrame.jsx'
import PhoneInput from './PhoneInput.jsx'
import ProgramSelect from './ProgramSelect.jsx'
import OtpInput from './OtpInput.jsx'

export default function StudentOnboarding({user,clientId,draft,onDraftChange,onSession,onLogout,onOpenPolicy,complete,onEnterPortal}) {
  const email=user?.onboarding_google_email||'', step=user?.onboarding_step||'GOOGLE', googleStage=user?.google_onboarding_stage||'EMAIL'
  const form=draft.profile, screen=draft.screen
  const buttonRef=useRef(null), callbackRef=useRef(null), heading=useRef(null), errorRef=useRef(null), acting=useRef(false)
  const [code,setCode]=useState(''), [now,setNow]=useState(Date.now), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const cooldown=Math.max(0,Math.ceil(((draft.resendAt||0)-now)/1000))
  const yearLevelOptions=yearOptions(form.academicLevel)
  const setForm=(update)=>onDraftChange(current=>({...current,profile:typeof update==='function'?update(current.profile):update}))
  const run=async(action)=>{
    if(acting.current)return
    acting.current=true
    setBusy(true)
    setError('')
    try{await action()}catch(e){setError(e.message)}finally{acting.current=false;setBusy(false)}
  }
  callbackRef.current=(response)=>run(async()=>{
    const credential=readGoogleCredential(response)
    if(!credential)throw new Error('Google did not return a valid sign-in response. Try again.')
    const data=await linkStudentGoogle(credential)
    onSession(data)
  })
  useEffect(()=>{heading.current?.focus()},[step,googleStage,screen,complete])
  useEffect(()=>{if(error)errorRef.current?.focus()},[error])
  useEffect(()=>{
    if(complete||step!=='GOOGLE'||googleStage!=='OAUTH'||!isGoogleClientConfigured(clientId))return undefined
    let active=true
    const node=buttonRef.current
    loadGoogleIdentityServices().then((google)=>{
      if(!active||!node)return
      node.replaceChildren()
      google.initialize(googleIdentityConfiguration({clientId,callback:(response)=>callbackRef.current?.(response)}))
      google.renderButton(node,googleButtonConfiguration({width:Math.min(360,node.clientWidth)}))
    }).catch((e)=>{if(active)setError(e.message)})
    return()=>{active=false;if(node)node.replaceChildren()}
  },[clientId,step,googleStage,complete])
  useEffect(()=>{
    if(!cooldown)return undefined
    const timer=window.setInterval(()=>setNow(Date.now()),1000)
    return()=>window.clearInterval(timer)
  },[cooldown])
  const change=(key)=>(event)=>setForm(current=>({...current,[key]:key==='guardianName'?normalizePersonName(event.target.value):event.target.value}))
  const changeAcademicLevel=(event)=>{
    const academicLevel=event.target.value
    setForm(current=>({...current,academicLevel,strand:'',program:'',yearLevel:''}))
    setError('')
  }
  const sendCode=(event)=>{
    event?.preventDefault()
    if(cooldown||busy)return
    run(async()=>{
      const data=await requestStudentGoogleEmail(email.trim())
      setCode('')
      const sentAt=Date.now()
      setNow(sentAt)
      onDraftChange(current=>({...current,resendAt:sentAt+60000}))
      onSession(data)
    })
  }
  const verifyCode=(event)=>{
    event.preventDefault()
    run(async()=>{const data=await verifyStudentGoogleEmail(code);setCode('');onSession(data)})
  }
  const submit=(event)=>{
    event.preventDefault()
    if(screen==='ACADEMIC'){
      onDraftChange(current=>({...current,screen:'CONTACT'}))
      setError('')
      return
    }
    run(async()=>{
      const profile={
        ...(form.academicLevel==='SENIOR_HIGH_SCHOOL'?{academic_level:form.academicLevel}:{}),
        strand:form.academicLevel==='SENIOR_HIGH_SCHOOL'?form.strand:null,
        program:form.academicLevel==='COLLEGE'?form.program:null,
        section:form.section.trim(),year_level:Number(form.yearLevel),
        phone_number:normalizePhilippinePhone(form.phoneNumber),guardian_name:normalizeNameSpacing(form.guardianName),
        guardian_relationship:form.guardianRelationship.trim(),guardian_phone_number:normalizePhilippinePhone(form.guardianPhoneNumber)
      }
      const data=await completeStudentOnboarding(profile)
      onSession(data,{onboardingComplete:true})
    })
  }
  const googleHeadings={EMAIL:['Confirm Your Gmail','We will send a verification code to the personal Gmail recorded by the Discipline Office.'],OTP:['Check Your Inbox','Enter the six-digit verification code to confirm this Gmail belongs to you.'],OAUTH:['Link Your Google Account','Your email is verified. Continue with the same Google account to finish linking it.']}
  const [title,description]=complete?['Your Account Is Ready','Your student account is secure and your information has been saved. You can now access the portal.']
    :step==='GOOGLE'?googleHeadings[googleStage]||googleHeadings.EMAIL
    :screen==='ACADEMIC'?['Add Your Academic Details','Tell us your current academic level, program or strand, section, and year.']
    :['Add Contact and Guardian Details','Add the phone numbers and guardian information the school can use to contact you.']
  const errorMessage=error&&<p className="error-message" id="onboarding-error" ref={errorRef} tabIndex="-1" role="alert">{error}</p>
  return <AccountSetupFrame current={complete?'COMPLETE':step} title={title} description={description} headingRef={heading} busy={busy} onLogout={onLogout} onOpenPolicy={onOpenPolicy}>
    {complete?<div className="setup-complete">
      <div className="setup-success-mark" aria-hidden="true">✓</div>
      <ul><li>Password Updated</li><li>Google Account Linked</li><li>Student Information Saved</li></ul>
      <button type="button" onClick={onEnterPortal}>Open Student Portal</button>
    </div>:step==='GOOGLE'?<section className="setup-google-stage" aria-label="Google Account Verification">
      <p className="setup-substep">Google Verification · {googleStage==='EMAIL'?'1 of 3: Email':googleStage==='OTP'?'2 of 3: Verification Code':'3 of 3: Google Sign-In'}</p>
      {googleStage==='EMAIL'?<form onSubmit={sendCode} className="setup-form">
        <p className="setup-email-summary"><span>Google Account Email</span><strong>{email||'No Gmail recorded. Contact the Discipline Office.'}</strong></p>
        <p className="setup-field-note" id="setup-email-help">Use the personal Gmail recorded by the Discipline Office. Contact the office to correct this address.</p>
        {errorMessage}
        <button type="submit" disabled={busy||cooldown>0||!email}>{busy?'Sending Code…':cooldown?`Send Again in ${cooldown}s`:'Send Verification Code'}</button>
      </form>:googleStage==='OTP'?<form onSubmit={verifyCode} className="setup-form">
        <p className="setup-email-summary">Code sent to <strong>{email}</strong></p>
        <OtpInput id="google-email-code" label="Verification Code" value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} describedBy={error?'onboarding-error':undefined}/>
        <p className="setup-field-note">Check your inbox and spam folder. Use the most recent code.</p>
        {errorMessage}
        <button type="submit" disabled={busy||code.length!==6}>{busy?'Verifying…':'Verify Email and Continue'}</button>
        <button type="button" className="text-button" onClick={sendCode} disabled={busy||cooldown>0}>{cooldown?`Resend Code in ${cooldown}s`:'Resend Code'}</button>
      </form>:<div className="setup-form">
        <p className="setup-email-summary setup-email-summary--verified"><span>✓ Email Verified</span><strong>{email}</strong></p>
        <p className="setup-field-note">In Google’s account chooser, select this exact Gmail address.</p>
        {isGoogleClientConfigured(clientId)?<><div ref={buttonRef} className="google-button" inert={busy?true:undefined} aria-busy={busy}/>{busy&&<p role="status">Linking your Google account…</p>}</>:<p className="error-message" role="alert">Google account setup is unavailable. Ask the Discipline Office to check the Google client configuration.</p>}
        {errorMessage}
      </div>}
    </section>:<form className="setup-form" onSubmit={submit} aria-busy={busy}>
      <p className="setup-substep">Student Information · {screen==='ACADEMIC'?'1 of 2: Academic Details':'2 of 2: Contact and Guardian'}</p>
      {screen==='ACADEMIC'?<fieldset className="onboarding-fieldset" disabled={busy}>
        <legend className="sr-only">Academic Information</legend>
        <div className="onboarding-academic-fields">
          <div className="onboarding-academic-level"><span id="onboarding-academic-level-label">Academic Level</span><div className="onboarding-academic-toggle" role="radiogroup" aria-labelledby="onboarding-academic-level-label">{[['COLLEGE','College'],['SENIOR_HIGH_SCHOOL','Senior High School']].map(([value,label])=><label key={value} className={form.academicLevel===value?'active':''}><input type="radio" name="academic_level" value={value} checked={form.academicLevel===value} onChange={changeAcademicLevel}/><span>{label}</span></label>)}</div></div>
          <div className="onboarding-academic-grid">
            {form.academicLevel==='COLLEGE'&&<label className="onboarding-program-field">Program<ProgramSelect value={form.program} onChange={change('program')} required/></label>}
            {form.academicLevel==='SENIOR_HIGH_SCHOOL'&&<label>Strand<select value={form.strand} onChange={change('strand')} required><option value="">Select a Strand</option>{STRANDS.map(([code,name])=><option key={code} value={code}>{code} - {name}</option>)}</select></label>}
            <label className="onboarding-year-field">{form.academicLevel==='SENIOR_HIGH_SCHOOL'?'Grade Level':'Year Level'}<select value={form.yearLevel} onChange={change('yearLevel')} required><option value="">{form.academicLevel==='SENIOR_HIGH_SCHOOL'?'Select Grade Level':'Select Year Level'}</option>{yearLevelOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label className="onboarding-section-field">Section<input value={form.section} onChange={change('section')} maxLength="100" pattern=".*\S.*" placeholder={form.academicLevel==='COLLEGE'?'e.g. A103':'e.g. STEM123'} required/></label>
          </div>
        </div>
      </fieldset>:<fieldset className="onboarding-fieldset" disabled={busy}>
        <legend className="sr-only">Contact and Guardian Information</legend>
        <div className="onboarding-contact-fields">
          <PhoneInput id="onboarding-phone" name="phone_number" label="Your Mobile Number" value={form.phoneNumber} onChange={change('phoneNumber')} required/>
          <div className="setup-field-divider"><h2>Guardian Contact</h2><p>Enter the details of your parent or guardian.</p></div>
          <label><span id="onboarding-guardian-name-label">Guardian’s Full Name</span><input value={form.guardianName} onChange={change('guardianName')} onBlur={event=>{const value=normalizeNameSpacing(event.target.value);setForm(current=>({...current,guardianName:value}))}} pattern={STUDENT_NAME_PATTERN} maxLength="200" placeholder="e.g. Maria Dela Cruz" aria-labelledby="onboarding-guardian-name-label" aria-describedby="onboarding-guardian-name-help" required/><small id="onboarding-guardian-name-help">Letters, spaces, apostrophes, hyphens, and periods only.</small></label>
          <label>Relationship to You<input value={form.guardianRelationship} onChange={change('guardianRelationship')} maxLength="100" pattern=".*\S.*" placeholder="e.g. Mother" required/></label>
          <PhoneInput id="onboarding-guardian-phone" name="guardian_phone_number" label="Guardian’s Mobile Number" value={form.guardianPhoneNumber} onChange={change('guardianPhoneNumber')} required/>
        </div>
      </fieldset>}
      <p className="setup-field-note">Your Student Number and legal name are managed by the Discipline Office.</p>
      {errorMessage}
      <div className="setup-actions">{screen==='CONTACT'&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{onDraftChange(current=>({...current,screen:'ACADEMIC'}));setError('')}}>Back</button>}<button type="submit" disabled={busy}>{busy?'Saving Student Information…':screen==='ACADEMIC'?'Continue to Contact Details':'Save and Finish Setup'}</button></div>
    </form>}
  </AccountSetupFrame>
}
