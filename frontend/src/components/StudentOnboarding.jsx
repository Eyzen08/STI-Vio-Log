import { useEffect, useRef, useState } from 'react'
import { completeStudentOnboarding, linkStudentGoogle } from '../lib/api.js'
import { googleButtonConfiguration, googleIdentityConfiguration, isGoogleClientConfigured, loadGoogleIdentityServices, readGoogleCredential } from '../lib/googleIdentity.js'
import { normalizePhilippinePhone } from '../lib/phone.js'
import OnboardingProgress from './OnboardingProgress.jsx'
import PhoneInput from './PhoneInput.jsx'

const emptyProfile={phoneNumber:'',guardianName:'',guardianRelationship:'',guardianPhoneNumber:''}

export default function StudentOnboarding({user,clientId,onSession,onLogout}) {
  const step=user?.onboarding_step||'GOOGLE',buttonRef=useRef(null),callbackRef=useRef(null)
  const [form,setForm]=useState(emptyProfile),[busy,setBusy]=useState(false),[error,setError]=useState('')
  callbackRef.current=async(response)=>{const credential=readGoogleCredential(response);if(!credential)return setError('Google did not return a valid sign-in response. Try again.');setBusy(true);setError('');try{const data=await linkStudentGoogle(credential);onSession(data)}catch(e){setError(e.message)}finally{setBusy(false)}}
  useEffect(()=>{if(step!=='GOOGLE'||!isGoogleClientConfigured(clientId))return undefined;let active=true,node=buttonRef.current;loadGoogleIdentityServices().then((google)=>{if(!active||!node)return;node.replaceChildren();google.initialize(googleIdentityConfiguration({clientId,callback:(response)=>callbackRef.current?.(response)}));google.renderButton(node,googleButtonConfiguration({width:node.clientWidth}))}).catch((e)=>active&&setError(e.message));return()=>{active=false;if(node)node.replaceChildren()}},[clientId,step])
  const change=(key)=>(event)=>setForm((current)=>({...current,[key]:event.target.value}))
  const submit=async(event)=>{event.preventDefault();setBusy(true);setError('');try{const data=await completeStudentOnboarding({phone_number:normalizePhilippinePhone(form.phoneNumber),guardian_name:form.guardianName,guardian_relationship:form.guardianRelationship,guardian_phone_number:normalizePhilippinePhone(form.guardianPhoneNumber)});setForm(emptyProfile);onSession(data)}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <main className="student-onboarding" id="main-content">
    <section className="student-onboarding-card" aria-labelledby="student-onboarding-title">
      <header><span className="badge">Required account setup</span><h1 id="student-onboarding-title">Finish securing your student account</h1><p>Your school record stays unchanged. Complete these steps once to enable portal access and password recovery.</p></header>
      <OnboardingProgress current={step}/>
      {step==='GOOGLE'?<section className="onboarding-stage"><div><h2>Bind your Google account</h2><p>Use a Google account you control. Its verified email becomes your password-recovery address.</p></div>{isGoogleClientConfigured(clientId)?<><div ref={buttonRef} className="google-button" aria-busy={busy}/>{busy&&<p role="status">Verifying your Google account…</p>}</>:<p className="error-message" role="alert">Google account setup is unavailable. Ask the Discipline Office to check the Google client configuration.</p>}</section>:<form className="onboarding-stage" onSubmit={submit}><div><h2>Add contact information</h2><p>These details support school follow-up. Your Student Number, legal name, program, section, and year level cannot be changed here.</p></div><div className="student-form-grid"><PhoneInput id="onboarding-phone" name="phone_number" label="Student phone number" value={form.phoneNumber} onChange={change('phoneNumber')} required/><label>Guardian name<input value={form.guardianName} onChange={change('guardianName')} maxLength="200" required autoFocus/></label><label>Guardian relationship<input value={form.guardianRelationship} onChange={change('guardianRelationship')} maxLength="100" required/></label><PhoneInput id="onboarding-guardian-phone" name="guardian_phone_number" label="Guardian phone number" value={form.guardianPhoneNumber} onChange={change('guardianPhoneNumber')} required/></div><button disabled={busy}>{busy?'Saving contact information…':'Save and enter portal'}</button></form>}
      {error&&<p className="error-message" role="alert">{error}</p>}
      <button type="button" className="secondary-button onboarding-signout" onClick={onLogout} disabled={busy}>Sign out</button>
    </section>
  </main>
}
