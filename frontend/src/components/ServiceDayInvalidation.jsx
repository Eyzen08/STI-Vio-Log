import { useEffect, useId, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatManilaDate, formatManilaDateTime } from '../lib/displayFormat.js'
import { formatServiceMinutes } from '../lib/departmentScanner.js'
import Modal from './Modal.jsx'

export function ServiceDayInvalidationHistory({ invalidations=[] }) {
  if(!invalidations.length) return null
  return <section aria-label="Invalidated Service Days"><h4>Invalidated Service Days</h4>{invalidations.map(day=><article key={day.id} className="service-day-invalidated">
    <strong>Day Invalidated · {formatManilaDate(day.service_date)} · Assignment #{day.assignment_id}</strong>
    <p>{[day.first_name,day.last_name].filter(Boolean).join(' ')} {day.student_number}</p><p>{formatServiceMinutes(day.removed_credit_minutes)} credit removed · {day.reason}</p>
    <p>{day.performed_by_name || `Staff #${day.performed_by_user_id}`} · {formatManilaDateTime(day.created_at)}</p>
  </article>)}</section>
}

export function ServiceDayInvalidationDetails({ session }) {
  const day=session.day_invalidation
  if (!day) return null
  return <section className="service-day-invalidated" aria-label="Day Invalidation">
    <strong>Day Invalidated · {formatManilaDate(day.service_date)}</strong>
    <p>{day.reason}</p>
    <p>{day.performed_by_name || `Staff #${day.performed_by_user_id}`} · {formatManilaDateTime(day.created_at)}</p>
    <p>{formatServiceMinutes(session.original_credited_minutes || 0)} previously credited for this session; now 0 min.</p>
    {session.completion_reason==='DAY_INVALIDATED' && <p>Administratively closed. This does not record the student returning.</p>}
  </section>
}

function InvalidationDialog({ assignmentId, date, token, onClose, onSaved }) {
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  const [reason,setReason]=useState('')
  const [busy,setBusy]=useState(false)
  const pending=useRef(false)
  const reasonId=useId()
  const url=`${API_URL}/api/community-service/${assignmentId}/days/${date}`
  useEffect(()=>{
    const controller=new AbortController()
    fetch(`${url}/invalidation-preview`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok) throw new Error(result.message || 'Unable to preview this day');return result})
      .then(setData).catch(failure=>{if(failure.name!=='AbortError')setError(failure.message)})
    return ()=>controller.abort()
  },[url,token])
  const save=async event=>{
    event.preventDefault()
    if(pending.current || !reason.trim() || !data?.preview_version) return
    pending.current=true;setBusy(true);setError('')
    try {
      const response=await fetch(`${url}/invalidate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason:reason.trim(),preview_version:data.preview_version})})
      const result=await response.json()
      if(!response.ok || !result.success) {
        if(result.error?.code==='STALE_DAY_PREVIEW') {
          setData(null)
          const refreshed=await fetch(`${url}/invalidation-preview`,{headers:{Authorization:`Bearer ${token}`}})
          const preview=await refreshed.json()
          if(!refreshed.ok) throw new Error(preview.message || 'Unable to refresh this day')
          setData(preview)
        }
        throw new Error(result.message || 'Unable to invalidate this day')
      }
      await onSaved?.(result,'invalidate-day')
      onClose()
    } catch(failure) {setError(failure.message)}
    finally {pending.current=false;setBusy(false)}
  }
  return <Modal title="Invalidate Service Day" className="service-workflow-modal" onClose={()=>{if(!pending.current)onClose()}}>
    {!data&&!error&&<p role="status">Checking the day’s attendance and credit…</p>}
    {data?.already_invalidated ? <><p>This day has already been invalidated.</p><p>{data.invalidation.reason}</p></> : data && <>
      <h3>{[data.student?.first_name,data.student?.last_name].filter(Boolean).join(' ')}</h3>
      <p>{data.student?.student_number} · Assignment #{assignmentId}</p>
      <dl className="service-confirm-details">
        <div><dt>Service Date</dt><dd>{formatManilaDate(date)}</dd></div>
        <div><dt>Affected Sessions</dt><dd>{data.sessions.length}</dd></div>
        <div><dt>Credit Removed</dt><dd>{formatServiceMinutes(data.removed_credit_minutes)}</dd></div>
        <div><dt>Completed After Cancellation</dt><dd>{formatServiceMinutes(data.new_completed_hours*60)}</dd></div>
        <div><dt>Remaining After Cancellation</dt><dd>{formatServiceMinutes(data.new_remaining_hours*60)}</dd></div>
      </dl>
      <ul className="service-day-sessions">{data.sessions.map(session=><li key={session.id}>Session #{session.id} · {formatManilaDateTime(session.time_in)} · {session.time_out ? `${formatServiceMinutes(session.credited_minutes || 0)} credited` : session.pause_history?.some(pause=>!pause.ended_at) ? 'Paused — will close without credit' : 'Active — will close without credit'}</li>)}</ul>
      <p className="service-invalidation-warning">All credit for this assignment on this date will be canceled. Active or paused sessions on that date will close. New service for this assignment must begin on a later date. Canceled time still uses the daily allowance.</p>
      <p className="field-help">Attendance history is retained. The Discipline Office can correct totals if a mistake is made.</p>
    </>}
    <form onSubmit={save}>
      {data&&!data.already_invalidated&&<><label htmlFor={reasonId}>Reason <small>Required</small></label><textarea id={reasonId} value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} required disabled={busy} aria-describedby={`${reasonId}-help${error?` ${reasonId}-error`:''}`}/><p id={`${reasonId}-help`} className="field-help">1–500 characters. The student can see this reason.</p></>}
      {error&&<p id={`${reasonId}-error`} className="error-message" role="alert">{error}</p>}
      <div className="service-confirm-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>{data?.already_invalidated?'Close':'Cancel'}</button>{!data?.already_invalidated&&<button type="submit" className="danger-button" disabled={!data?.preview_version||!reason.trim()||busy}>{busy?'Invalidating…':'Invalidate Day'}</button>}</div>
    </form>
  </Modal>
}

export default function ServiceDayInvalidation({ assignmentId, date, token, disabled=false, onSaved }) {
  const [open,setOpen]=useState(false)
  return <><button type="button" className="secondary-button service-invalidate-button" disabled={disabled||!date||!assignmentId} onClick={()=>setOpen(true)}>Invalidate Day</button>
    {open&&<InvalidationDialog assignmentId={assignmentId} date={date} token={token} onClose={()=>setOpen(false)} onSaved={onSaved}/>}</>
}
