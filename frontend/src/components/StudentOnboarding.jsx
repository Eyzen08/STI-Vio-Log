import { useEffect, useRef, useState } from 'react'
import { academicLevelLabel, academicProgram, academicYear } from '../lib/studentAcademic.js'
import { apiRequest, completeStudentOnboarding, linkStudentGoogle, requestStudentGoogleEmail, verifyStudentGoogleEmail } from '../lib/api.js'
import { googleButtonConfiguration, googleIdentityConfiguration, isGoogleClientConfigured, loadGoogleIdentityServices, readGoogleCredential } from '../lib/googleIdentity.js'
import { formatPhilippinePhone } from '../lib/phone.js'
import AccountSetupFrame from './AccountSetupFrame.jsx'
import OtpInput from './OtpInput.jsx'

const fullName = (profile) => [profile?.first_name, profile?.middle_name, profile?.last_name, profile?.suffix].filter(Boolean).join(' ')

export default function StudentOnboarding({user,clientId,draft,onDraftChange,onSession,onLogout,onOpenPolicy,complete,onEnterPortal}) {
  const email=user?.onboarding_google_email||'', step=user?.onboarding_step||'GOOGLE', googleStage=user?.google_onboarding_stage||'EMAIL'
  const buttonRef=useRef(null), callbackRef=useRef(null), heading=useRef(null), errorRef=useRef(null), acting=useRef(false)
  const [code,setCode]=useState(''), [now,setNow]=useState(Date.now), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const [profile,setProfile]=useState(null), [profileError,setProfileError]=useState(''), [loadingProfile,setLoadingProfile]=useState(false)
  const cooldown=Math.max(0,Math.ceil(((draft.resendAt||0)-now)/1000))
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
  useEffect(()=>{heading.current?.focus()},[step,googleStage,complete])
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
  useEffect(()=>{
    if(complete||step!=='PROFILE')return undefined
    const controller=new AbortController()
    let active=true
    setLoadingProfile(true)
    setProfileError('')
    apiRequest('/api/students/me',{signal:controller.signal}).then(data=>{
      if(active)setProfile(data.student)
    }).catch(e=>{
      if(active&&e?.name!=='AbortError')setProfileError(e.message||'Unable to load your student information.')
    }).finally(()=>{
      if(active)setLoadingProfile(false)
    })
    return()=>{active=false;controller.abort()}
  },[step,complete])
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
    run(async()=>{
      const data=await completeStudentOnboarding({})
      onSession(data,{onboardingComplete:true})
    })
  }
  const googleHeadings={EMAIL:['Confirm Your Gmail','We will send a verification code to the personal Gmail recorded by the Discipline Office.'],OTP:['Check Your Inbox','Enter the six-digit verification code to confirm this Gmail belongs to you.'],OAUTH:['Link Your Google Account','Your email is verified. Continue with the same Google account to finish linking it.']}
  const [title,description]=complete?['Your Account Is Ready','Your student account is secure and your information has been saved. You can now access the portal.']
    :step==='GOOGLE'?googleHeadings[googleStage]||googleHeadings.EMAIL
    :['Review Your Student Information','These details were recorded by the Discipline Office. Review them before finishing setup. Contact the office if a correction is needed.']
  const errorMessage=error&&<p className="error-message" id="onboarding-error" ref={errorRef} tabIndex="-1" role="alert">{error}</p>
  return <AccountSetupFrame current={complete?'COMPLETE':step} title={title} description={description} headingRef={heading} busy={busy} onLogout={onLogout} onOpenPolicy={onOpenPolicy}>
    {complete?<div className="setup-complete">
      <div className="setup-success-mark" aria-hidden="true">✓</div>
      <ul><li>Password Updated</li><li>Google Account Linked</li><li>Student Information Confirmed</li></ul>
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
        <p className="setup-field-note">In Google's account chooser, select this exact Gmail address.</p>
        {isGoogleClientConfigured(clientId)?<><div ref={buttonRef} className="google-button" inert={busy?true:undefined} aria-busy={busy}/>{busy&&<p role="status">Linking your Google account…</p>}</>:<p className="error-message" role="alert">Google account setup is unavailable. Ask the Discipline Office to check the Google client configuration.</p>}
        {errorMessage}
      </div>}
    </section>:<form className="setup-form" onSubmit={submit} aria-busy={busy||loadingProfile}>
      <p className="setup-substep">Student Information · Official Record</p>
      {loadingProfile?<p className="empty-state" role="status">Loading your student information…</p>:profileError?<div className="setup-form">
        <p className="error-message" role="alert">{profileError}</p>
        <button type="button" onClick={()=>{setProfileError('');setLoadingProfile(true);apiRequest('/api/students/me').then(data=>setProfile(data.student)).catch(e=>setProfileError(e.message||'Unable to load your student information.')).finally(()=>setLoadingProfile(false))}} disabled={busy}>Try Again</button>
      </div>:profile?<>
        <section className="student-account-review-section" aria-labelledby="onboarding-identity"><h2 id="onboarding-identity">Student Identity</h2>
          <dl className="onboarding-review-list">
            <div><dt>Student Number</dt><dd>{profile.student_number}</dd></div>
            <div><dt>Legal Name</dt><dd>{fullName(profile)}</dd></div>
            <div><dt>Student Gmail</dt><dd>{profile.email}</dd></div>
          </dl>
        </section>
        <section className="student-account-review-section" aria-labelledby="onboarding-academic"><h2 id="onboarding-academic">Academic Information</h2>
          <dl className="onboarding-review-list">
            <div><dt>Academic Level</dt><dd>{academicLevelLabel(profile)}</dd></div>
            <div><dt>Program / Strand</dt><dd>{academicProgram(profile)}</dd></div>
            <div><dt>Year / Grade Level</dt><dd>{academicYear(profile)}</dd></div>
            <div><dt>Section</dt><dd>{profile.section||'Not recorded'}</dd></div>
          </dl>
        </section>
        <section className="student-account-review-section" aria-labelledby="onboarding-contact"><h2 id="onboarding-contact">Contact and Guardian</h2>
          <dl className="onboarding-review-list">
            <div><dt>Mobile Number</dt><dd>{formatPhilippinePhone(profile.phone_number)||'Not recorded'}</dd></div>
            <div><dt>Guardian's Full Name</dt><dd>{profile.guardian_name||'Not recorded'}</dd></div>
            <div><dt>Relationship</dt><dd>{profile.guardian_relationship||'Not recorded'}</dd></div>
            <div><dt>Guardian Mobile Number</dt><dd>{formatPhilippinePhone(profile.guardian_phone_number)||'Not recorded'}</dd></div>
          </dl>
        </section>
      </>:null}
      <p className="setup-field-note">Your Student Number, legal name, academic details, and guardian contacts are managed by the Discipline Office and cannot be edited here.</p>
      {errorMessage}
      <div className="setup-actions"><button type="submit" disabled={busy||loadingProfile||!profile}>{busy?'Finishing Setup…':'Confirm and Finish Setup'}</button></div>
    </form>}
  </AccountSetupFrame>
}
