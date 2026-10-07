import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatServiceMinutes } from '../lib/departmentScanner.js'
import { formatManilaTime, formatDisplayLabel } from '../lib/displayFormat.js'
import Modal from './Modal.jsx'

export default function ServiceTimeOutDialog({ session, token, supervisingOfficerId, initialNotes='', onClose, onSaved }) {
  const [data,setData] = useState(null)
  const [notes,setNotes] = useState(initialNotes)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [officerId,setOfficerId] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/api/community-service/sessions/${session.session_id||session.id}/time-out-preview`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(async response => {const body=await response.json(); if(!response.ok) throw new Error(body.message||'Unable to preview Time Out'); return body})
      .then(body=>{setData(body);const officers=body.available_officers||[];setOfficerId(String(officers.find(officer=>Number(officer.officer_user_id)===Number(supervisingOfficerId||body.session.supervising_officer_user_id))?.officer_user_id||(officers.length===1?officers[0].officer_user_id:'')))}).catch(failure=>{if(failure.name!=='AbortError') setError(failure.message)})
    return () => controller.abort()
  },[session.session_id,session.id,token,supervisingOfficerId])
  const save = async () => {
    if(busy) return
    setBusy(true);setError('')
    try {
      if(data?.already_completed){await onSaved(data);onClose();return}
      const response=await fetch(`${API_URL}/api/community-service/attendance/time-out`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({assignment_id:Number(session.assignment_id),student_id:Number(session.student_id),session_id:Number(session.session_id||session.id),notes:notes.trim(),...(officerId?{supervising_officer_id:Number(officerId)}:{})})})
      const result=await response.json()
      if(!response.ok||!result.success) throw new Error(result.message||'Unable to save Time Out')
      await onSaved(result);onClose()
    } catch(failure) {setError(failure.message)} finally {setBusy(false)}
  }
  const preview=data?.preview
  const early=!data?.already_completed&&preview?.completionReason==='EARLY_TIME_OUT'
  return <Modal title={data?.already_completed?'Time Out Already Saved':early?'Service Time Not Yet Completed':'Confirm Time Out'} className="service-workflow-modal" onClose={()=>{if(!busy) onClose()}}>
    {!data&&!error&&<p>Checking server timestamps and service allowance…</p>}
    {data&&<><h3>{data.session.first_name} {data.session.last_name}</h3><p>{data.session.student_number} · {data.session.department_name}</p>
      <dl className="service-confirm-details"><div><dt>Time In</dt><dd>{formatManilaTime(data.session.time_in)}</dd></div><div><dt>{data.already_completed?'Saved Time Out':'Time Out estimate'}</dt><dd>{formatManilaTime(data.session.time_out||preview.server_time)}</dd></div><div><dt>Selected target</dt><dd>{data.session.session_type==='FIXED'?formatServiceMinutes(data.session.selected_duration_minutes):'Open Time'}</dd></div><div><dt>Actual service</dt><dd>{formatServiceMinutes(preview.workedMinutes)}</dd></div><div><dt>Credited service</dt><dd>{formatServiceMinutes(preview.creditedMinutes)}</dd></div><div><dt>Status</dt><dd>{formatDisplayLabel(preview.completionReason)}</dd></div></dl>
      {early&&<p className="service-timer-warning">The selected service duration is incomplete. Only actual eligible service time will be credited.</p>}
      <p className="field-help">Final time and credit are recalculated by the server when you confirm.</p><label>Supervising officer<select value={officerId} onChange={event=>setOfficerId(event.target.value)} disabled={busy||data.already_completed}><option value="">Select an authorized officer</option>{(data.available_officers||[]).map(officer=><option key={officer.officer_user_id} value={officer.officer_user_id}>{officer.first_name} {officer.last_name}</option>)}</select></label>{!data.already_completed&&!data.available_officers?.length&&<p role="alert">No authorized supervising officer is available. Contact the Discipline Office.</p>}<label>Notes / Remarks <small>Optional</small><textarea value={notes} onChange={event=>setNotes(event.target.value)} maxLength="500" disabled={busy}/></label></>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="service-confirm-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>{early?'Continue Service':'Cancel'}</button><button type="button" onClick={save} disabled={!data||(!data.already_completed&&!officerId)||busy}>{busy?'Saving…':data?.already_completed?'Close':early?'Time Out Anyway':'Confirm Time Out'}</button></div>
  </Modal>
}
