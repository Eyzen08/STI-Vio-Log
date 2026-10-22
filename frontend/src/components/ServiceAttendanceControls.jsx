import { useId, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { serviceSessionTiming } from '../lib/departmentService.js'
import useServiceClock from '../lib/useServiceClock.js'
import Modal from './Modal.jsx'
import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'
import '../styles/community-workflow.css'

export default function ServiceAttendanceControls({ session, token, onSaved, supervisingOfficerId, initialNotes = '', disabled = false }) {
  const [dialog, setDialog] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const reasonId = useId()
  const serverNow = useServiceClock(session?.server_time)
  const limitReached = serviceSessionTiming(session, serverNow ?? Date.now()).limitReached
  const change = async (action) => {
    if (pending.current || disabled || limitReached) return
    if (action === 'pause' && (!reason.trim() || reason.trim().length > 500)) {
      setError('Enter a pause reason from 1 to 500 characters.')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/community-service/sessions/${session.session_id || session.id}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'pause' ? { reason: reason.trim() } : {})
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || `Unable to ${action} service.`)
      await onSaved?.(result, action)
      setDialog('')
      setReason('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return <>
    <div className="service-attendance-controls" aria-label="Attendance Actions">
      <button type="button" className="secondary-button" disabled={disabled || busy || limitReached} onClick={() => { setError(''); if (session.paused_at) change('resume'); else setDialog('pause') }}>{busy ? 'Saving…' : session.paused_at ? 'Resume' : 'Pause'}</button>
      <button type="button" className="time-out-button" disabled={disabled || busy} onClick={() => setDialog('time-out')}>Time Out</button>
    </div>
    {error && dialog !== 'pause' && <p className="error-message" role="alert">{error}</p>}
    {dialog === 'pause' && <Modal title="Pause Service" className="service-workflow-modal" onClose={() => { if (!busy) setDialog('') }}>
      <p>Service time stops until an authorized staff member resumes this session. You can also record Time Out while paused.</p>
      <form onSubmit={event => { event.preventDefault(); change('pause') }}>
        <label htmlFor={reasonId}>Pause Reason <small>Required</small></label>
        <textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={`${reasonId}-help${error ? ` ${reasonId}-error` : ''}`} />
        <p className="field-help" id={`${reasonId}-help`}>1–500 characters. This reason is saved in the session history.</p>
        {limitReached && <p role="status">Service limit reached. Cancel and record Time Out.</p>}
        {error && <p className="error-message" role="alert" id={`${reasonId}-error`}>{error}</p>}
        <div className="service-confirm-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDialog('')}>Cancel</button><button type="submit" disabled={busy || limitReached || !reason.trim()}>{busy ? 'Saving…' : 'Confirm Pause'}</button></div>
      </form>
    </Modal>}
    {dialog === 'time-out' && <ServiceTimeOutDialog session={session} token={token} supervisingOfficerId={supervisingOfficerId} initialNotes={initialNotes} onClose={() => setDialog('')} onSaved={result => onSaved?.(result, 'time-out')} />}
  </>
}
