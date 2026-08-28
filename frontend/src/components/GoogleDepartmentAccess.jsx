import { useEffect, useRef, useState } from 'react'
import { googleDepartmentLogin, googleDepartmentRegister } from '../lib/api.js'
import { isGoogleClientConfigured, loadGoogleIdentityServices, readGoogleCredential } from '../lib/googleIdentity.js'

const emptyForm = { firstName:'', lastName:'', employeeNumber:'', departmentType:'LIBRARY', departmentName:'', note:'' }

function GoogleDepartmentAccess({ clientId, mode='login', onSession, onNavigate }) {
  const buttonRef = useRef(null)
  const handlerRef = useRef(null)
  const [credential,setCredential] = useState('')
  const [form,setForm] = useState(emptyForm)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [pending,setPending] = useState(false)

  handlerRef.current = async (response) => {
    const next = readGoogleCredential(response)
    if (!next) return setError('Google did not return a valid sign-in response. Please try again.')
    if (mode === 'register') { setCredential(next); return }
    setBusy(true); setError('')
    try { onSession(await googleDepartmentLogin(next)) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!isGoogleClientConfigured(clientId) || credential) return undefined
    let active=true; const node=buttonRef.current
    loadGoogleIdentityServices().then((google) => {
      if (!active || !node) return
      node.replaceChildren(); google.initialize({ client_id:clientId.trim(), callback:(response) => handlerRef.current?.(response) })
      google.renderButton(node,{ type:'standard',theme:'outline',size:'large',text:'continue_with',shape:'rectangular',width:node.clientWidth })
    }).catch((e) => { if(active) setError(e.message) })
    return () => { active=false; if(node) node.replaceChildren() }
  },[clientId,credential])

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await googleDepartmentRegister({ credential,...form }); setCredential(''); setForm(emptyForm); setPending(true) }
    catch(e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!isGoogleClientConfigured(clientId)) return <p className="error-message">Google sign-in is not configured.</p>
  if (pending) return <div className="registration-pending" role="status"><h4>Administrator verification pending</h4><p>Your request was submitted. Portal access remains disabled until an administrator verifies your office and assigns your account to a department.</p><button type="button" className="secondary-button" onClick={() => onNavigate('/department/login')}>Back to department sign in</button></div>

  return <section className="google-access" aria-labelledby="department-google-title">
    <div className="auth-divider"><span>Department officer access</span></div>
    {!credential ? <><h4 id="department-google-title">Continue with your school Google account</h4><div ref={buttonRef} className="google-button" aria-busy={busy}/>{busy && <p role="status">Checking your account…</p>}</> :
      <form className="google-link-form" onSubmit={submit}>
        <div><h4 id="department-google-title">Request a department account</h4><p>An administrator will verify these details before access is granted.</p></div>
        <label>Officer first name<input value={form.firstName} onChange={(e)=>setForm({...form,firstName:e.target.value})} maxLength="100" autoComplete="given-name" required autoFocus/></label>
        <label>Officer last name<input value={form.lastName} onChange={(e)=>setForm({...form,lastName:e.target.value})} maxLength="100" autoComplete="family-name" required/></label>
        <label>Employee number (optional)<input value={form.employeeNumber} onChange={(e)=>setForm({...form,employeeNumber:e.target.value})} maxLength="50" autoComplete="off"/></label>
        <label>Department type<select value={form.departmentType} onChange={(e)=>setForm({...form,departmentType:e.target.value})}><option value="LIBRARY">Library</option><option value="SCHOOL_GUARD">School guard / Security</option><option value="STAFF_OFFICE">Staff office</option><option value="OTHER">Other</option></select></label>
        <label>Department name<input value={form.departmentName} onChange={(e)=>setForm({...form,departmentName:e.target.value})} maxLength="150" required/></label>
        <label>Note (optional)<textarea value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} maxLength="1000"/></label>
        <div className="google-link-actions"><button disabled={busy}>{busy?'Submitting…':'Submit for verification'}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setCredential('')}>Cancel</button></div>
      </form>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}
export default GoogleDepartmentAccess
