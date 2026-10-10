import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PortalIcon from './PortalIcon.jsx'
import { API_URL } from '../lib/api.js'
import { buildGoogleRecoveryPayload } from '../lib/accountAdmin.js'
import Modal from './Modal.jsx'
import PhoneInput from './PhoneInput.jsx'
import { normalizePhilippinePhone } from '../lib/phone.js'
import { normalizePersonName, normalizeNameSpacing, digitsOnly, emailWithoutSpaces, STUDENT_NUMBER_PATTERN, STUDENT_NAME_PATTERN, STUDENT_SUFFIXES } from '../lib/inputNormalization.js'
import StudentAcademicFields from './StudentAcademicFields.jsx'
import StudentCredentialDetails from './StudentCredentialDetails.jsx'

const editableFields = ['student_number','first_name','middle_name','last_name','suffix','email','phone_number','academic_level','strand','program','section','year_level']
const initialEdit = (student) => Object.fromEntries(editableFields.map((field) => [field, student[field] ?? '']))

function StudentAccountActions({ token, student, onUpdated, onServiceTime, onGuardianContact }) {
  const menuRef = useRef(null)
  const popupRef = useRef(null)
  const triggerRef = useRef(null)
  const [menuOpen,setMenuOpen]=useState(false)
  const [menuPosition, setMenuPosition] = useState({})
  useEffect(() => {
    if (!menuOpen) return undefined
    popupRef.current?.querySelector('button')?.focus()
    const dismiss = (event) => { if (!menuRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setMenuOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus() } }
    const reposition = (event) => { if (!popupRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition) }
  }, [menuOpen])
  const toggleMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect()
    const height = 3 * 44 + Number(Boolean(onServiceTime)) * 44 + Number(Boolean(onGuardianContact)) * 44 + 12
    setMenuPosition({ left: Math.max(8, Math.min(rect.right - 230, window.innerWidth - 238)), top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 6) : rect.bottom + 6 })
    setMenuOpen((value) => !value)
  }
  const menuKeys = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...popupRef.current.querySelectorAll('button')]
    const current = items.indexOf(document.activeElement)
    items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  const secondary = (action) => { setMenuOpen(false); action() }
  const [mode,setMode]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[secret,setSecret]=useState(null)
  const [edit,setEdit]=useState(()=>initialEdit(student))
  const nameField = (field, placeholder) => ({value:edit[field],placeholder,maxLength:150,pattern:edit[field] === (student[field] ?? '') ? undefined : STUDENT_NAME_PATTERN,'aria-describedby':'edit-student-name-help',onChange:event=>setEdit(current=>({...current,[field]:normalizePersonName(event.target.value)})),onBlur:event=>{const value=event.target.value;if(value !== (student[field] ?? ''))setEdit(current=>({...current,[field]:normalizeNameSpacing(value)}))}})
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
  const close=()=>{setMode('');setReason('');setError('');setSuccess('');setSecret(null)}
  const open=(nextMode)=>{setMenuOpen(false);setEdit(initialEdit(student));setMode(nextMode);setReason('');setError('');setSuccess('');setSecret(null)}

  const submit=async(event)=>{
    event.preventDefault();const why=reason.trim();if(!why)return setError('Enter a reason before continuing.');setBusy(true);setError('');setSuccess('')
    try{
      if(mode==='edit'){
        const phone=edit.phone_number?normalizePhilippinePhone(edit.phone_number):''
        if(edit.phone_number&&!phone)throw new Error('Enter a valid Philippine mobile number in the format +63 9XX XXX XXXX.')
        const response=await fetch(`${API_URL}/api/students/${student.id}`,{method:'PUT',headers,body:JSON.stringify({...Object.fromEntries(Object.entries(edit).filter(([key,value])=>String(value??'')!==String(student[key]??''))),phone_number:phone,reason:why})}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to update student information.')
        onUpdated?.(data.student);setSuccess('Student information updated. Existing disciplinary history remains attached.');setMode('success')
      }else if(mode==='password'){
        const response=await fetch(`${API_URL}/api/students/${student.id}/password-reset`,{method:'POST',headers,body:JSON.stringify({reason:why})}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to issue a temporary password.')
        setSecret({username:data.account.username,password:data.temporary_password});setSuccess('Temporary credentials generated.')
      }else{
        const response=await fetch(`${API_URL}/api/admin/students/${student.id}/google-link/revoke`,{method:'POST',headers,body:JSON.stringify(buildGoogleRecoveryPayload(why,edit.email))}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to remove Google access.')
        setSuccess('Google access and sessions revoked. The student must sign in with their local password, verify the recorded Gmail, and bind it before returning to the portal.');setMode('success')
      }
    }catch(requestError){setError(requestError.message)}finally{setBusy(false)}
  }

  const title=secret?'Temporary student credentials':mode==='edit'?'Edit student information':mode==='password'?'Issue temporary password':mode==='google'?'Remove Google access':'Action completed'
  return <div className="student-access-removal">
    <div ref={menuRef} className="row-action-menu">
      <button ref={triggerRef} type="button" className="row-action-trigger" aria-label={`More actions for ${student.first_name} ${student.last_name}`} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={menuOpen ? `student-actions-${student.id}` : undefined} onClick={toggleMenu} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!menuOpen) toggleMenu() } }}>⋮</button>
      {menuOpen&&createPortal(<div ref={popupRef} id={`student-actions-${student.id}`} role="menu" aria-label={`Actions for ${student.first_name} ${student.last_name}`} className="student-account-menu" style={menuPosition} onKeyDown={menuKeys}>
        {onServiceTime && <button role="menuitem" type="button" onClick={() => secondary(onServiceTime)}><PortalIcon name="clock"/>Show Service Time</button>}
        {onGuardianContact && <button role="menuitem" type="button" onClick={() => secondary(onGuardianContact)}><PortalIcon name="phone"/>Guardian Contact</button>}
        <button role="menuitem" type="button" onClick={()=>open('edit')}>Edit information</button><button role="menuitem" type="button" onClick={()=>open('password')}>Issue password</button><button role="menuitem" type="button" className="danger-text" onClick={()=>open('google')}>Remove Google access</button>
      </div>, document.body)}
    </div>
    {(mode||secret)&&<Modal title={title} wide={mode==='edit'} dirty={!secret && mode !== 'success' && (Boolean(reason.trim()) || mode === 'edit' && JSON.stringify(edit) !== JSON.stringify(initialEdit(student)))} onClose={() => !busy && close()}>
      {secret?<div className="registration-pending student-credentials"><strong>Temporary password issued</strong><StudentCredentialDetails username={secret.username} password={secret.password} disabled={busy}/><p className="student-credentials-gmail">Recorded Gmail: <strong>{student.email||'Not recorded'}</strong></p><button type="button" onClick={close}>I stored it securely</button></div>:mode==='success'?<div><p className="success-message" role="status">{success}</p><button type="button" onClick={close}>Done</button></div>:<form className="student-form account-action-form" onSubmit={submit}>
        {mode==='edit'&&<div className="student-form-grid"><label>Student Number<input value={edit.student_number} onChange={e=>setEdit({...edit,student_number:digitsOnly(e.target.value)})} inputMode="numeric" pattern={edit.student_number === student.student_number ? undefined : STUDENT_NUMBER_PATTERN} maxLength={11} placeholder="02000123456" aria-describedby="edit-student-number-help" required/><small id="edit-student-number-help">Enter your 11-digit Student Number.</small></label><label>First name<input {...nameField('first_name','Juan')} required/><small id="edit-student-name-help">Letters, spaces, apostrophes, hyphens, and periods only.</small></label><label>Middle name (optional)<input {...nameField('middle_name','Santos')}/></label><label>Last name<input {...nameField('last_name','Dela Cruz')} required/></label><label>Suffix (optional)<select value={edit.suffix} onChange={e=>setEdit({...edit,suffix:e.target.value})}><option value="">None</option>{student.suffix && !STUDENT_SUFFIXES.includes(student.suffix) && <option value={student.suffix}>Recorded: {student.suffix}</option>}{STUDENT_SUFFIXES.map(suffix=><option key={suffix} value={suffix}>{suffix}</option>)}</select></label><label>Email<input type="email" value={edit.email} onChange={e=>setEdit({...edit,email:emailWithoutSpaces(e.target.value)})} placeholder="juan.delacruz@gmail.com"/></label><PhoneInput id={`student-edit-phone-${student.id}`} name="phone_number" value={edit.phone_number} onChange={e=>setEdit({...edit,phone_number:e.target.value})}/><StudentAcademicFields value={edit} onChange={values=>setEdit({...edit,...values})} required={false} legacy/></div>}
        {mode==='password'&&<p className="account-action-notice">This creates a temporary password that expires after 24 hours for Student Number <strong>{student.student_number}</strong>, invalidates existing sessions, and requires a password change at first sign-in. Google sign-in remains available.</p>}
        {mode==='google'&&<p className="account-action-notice account-action-notice--danger">Check the student’s identity against school records before recovery. Google access and sessions will be revoked; the student must verify the recorded Gmail and bind it again. Academic and disciplinary records are preserved.</p>}
        {mode==='google'&&<label>Recovery Gmail<input type="email" value={edit.email} onChange={event=>setEdit({...edit,email:emailWithoutSpaces(event.target.value)})} required/><small>Use the same Gmail or enter the verified replacement requested by the student.</small></label>}<label className="account-reason-field"><span>Required reason</span><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength="1000" placeholder="Briefly explain why this action is required" required autoFocus={mode!=='edit'}/><small>{reason.length} / 1000</small></label>
        {error&&<p className="error-message" role="alert">{error}</p>}
        <div className="registration-review-actions"><button type="submit" className={mode==='google'?'danger-button':''} disabled={busy}>{busy?'Saving…':'Confirm action'}</button><button type="button" className="secondary-button" data-modal-dismiss disabled={busy}>Cancel</button></div>
      </form>}
    </Modal>}
  </div>
}

export default StudentAccountActions
