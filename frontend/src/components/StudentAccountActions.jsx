import { useState } from 'react'
import { API_URL } from '../lib/api.js'
import { buildGoogleRecoveryPayload } from '../lib/accountAdmin.js'
import Modal from './Modal.jsx'

const editableFields = ['student_number','first_name','middle_name','last_name','suffix','email','phone_number','program','section','year_level']
const initialEdit = (student) => Object.fromEntries(editableFields.map((field) => [field, student[field] ?? '']))

function StudentAccountActions({ token, student, onUpdated }) {
  const [mode,setMode]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[secret,setSecret]=useState(null)
  const [edit,setEdit]=useState(()=>initialEdit(student))
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
  const close=()=>{setMode('');setReason('');setError('');setSuccess('');setSecret(null)}
  const open=(nextMode)=>{setEdit(initialEdit(student));setMode(nextMode);setReason('');setError('');setSuccess('');setSecret(null)}

  const submit=async(event)=>{
    event.preventDefault();const why=reason.trim();if(!why)return setError('Enter a reason before continuing.');setBusy(true);setError('');setSuccess('')
    try{
      if(mode==='edit'){
        const response=await fetch(`${API_URL}/api/students/${student.id}`,{method:'PUT',headers,body:JSON.stringify({...edit,year_level:edit.year_level===''?null:Number(edit.year_level),reason:why})}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to update student information.')
        onUpdated?.(data.student);setSuccess('Student information updated. Existing disciplinary history remains attached.');setMode('success')
      }else if(mode==='password'){
        const response=await fetch(`${API_URL}/api/students/${student.id}/password-reset`,{method:'POST',headers,body:JSON.stringify({reason:why})}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to issue a temporary password.')
        setSecret({username:data.account.username,password:data.temporary_password});setSuccess('Temporary credentials generated.')
      }else{
        const response=await fetch(`${API_URL}/api/admin/students/${student.id}/google-link/revoke`,{method:'POST',headers,body:JSON.stringify(buildGoogleRecoveryPayload(why))}),data=await response.json().catch(()=>null)
        if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to remove Google access.')
        setSuccess('Google access removed. The student may link Google again or use issued local credentials.');setMode('success')
      }
    }catch(requestError){setError(requestError.message)}finally{setBusy(false)}
  }

  const title=secret?'Temporary student credentials':mode==='edit'?'Edit student information':mode==='password'?'Issue temporary password':mode==='google'?'Remove Google access':'Action completed'
  return <div className="student-access-removal">
    <div className="registration-review-actions"><button type="button" className="secondary-button" onClick={()=>open('edit')}>Edit information</button><button type="button" className="secondary-button" onClick={()=>open('password')}>Issue password</button><button type="button" className="danger-button" onClick={()=>open('google')}>Remove Google access</button></div>
    {(mode||secret)&&<Modal title={title} wide={mode==='edit'} onClose={close}>
      {secret?<div className="registration-pending" role="alert"><strong>Copy these credentials now</strong><p>Username: <code>{secret.username}</code></p><p>Temporary password: <code>{secret.password}</code></p><p>The student must change this password after first sign-in.</p><button type="button" onClick={close}>I stored it securely</button></div>:mode==='success'?<div><p className="success-message" role="status">{success}</p><button type="button" onClick={close}>Done</button></div>:<form className="student-access-removal" onSubmit={submit}>
        {mode==='edit'&&<div className="student-form-grid"><label>Student Number<input value={edit.student_number} onChange={e=>setEdit({...edit,student_number:e.target.value})} required/></label><label>First name<input value={edit.first_name} onChange={e=>setEdit({...edit,first_name:e.target.value})} required/></label><label>Middle name<input value={edit.middle_name} onChange={e=>setEdit({...edit,middle_name:e.target.value})}/></label><label>Last name<input value={edit.last_name} onChange={e=>setEdit({...edit,last_name:e.target.value})} required/></label><label>Suffix<input value={edit.suffix} onChange={e=>setEdit({...edit,suffix:e.target.value})}/></label><label>Email<input type="email" value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></label><label>Phone number<input value={edit.phone_number} onChange={e=>setEdit({...edit,phone_number:e.target.value})}/></label><label>Program<input value={edit.program} onChange={e=>setEdit({...edit,program:e.target.value})}/></label><label>Section<input value={edit.section} onChange={e=>setEdit({...edit,section:e.target.value})}/></label><label>Year level<input type="number" min="1" max="8" value={edit.year_level} onChange={e=>setEdit({...edit,year_level:e.target.value})}/></label></div>}
        {mode==='password'&&<p>This creates a one-time temporary password for Student Number <strong>{student.student_number}</strong>, invalidates existing sessions, and requires a password change at first sign-in. Google sign-in remains available.</p>}
        {mode==='google'&&<p>The student record and local password access remain preserved. Only the Google link and existing sessions are revoked.</p>}
        <label>Required reason<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength="1000" required autoFocus={mode!=='edit'}/></label>
        {error&&<p className="error-message" role="alert">{error}</p>}
        <div className="registration-review-actions"><button type="submit" className={mode==='google'?'danger-button':''} disabled={busy}>{busy?'Saving…':'Confirm action'}</button><button type="button" className="secondary-button" onClick={close} disabled={busy}>Cancel</button></div>
      </form>}
    </Modal>}
  </div>
}

export default StudentAccountActions
