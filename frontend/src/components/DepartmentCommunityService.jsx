import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { filterDepartmentService, formatLiveServiceTime, liveServiceSeconds, serviceProgress, summarizeDepartmentService } from '../lib/departmentService.js'

const emptyTimeOut = { condition: '', notes: '' }

function DepartmentCommunityService({ assignments, loading, error, onOpenScanner, token, onAttendanceUpdated, realtimeSocket }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [activeSessions, setActiveSessions] = useState([])
  const [activeError, setActiveError] = useState('')
  const [activeLoading, setActiveLoading] = useState(true)
  const [timeOutForms, setTimeOutForms] = useState({})
  const [busySession, setBusySession] = useState(null)
  const [now, setNow] = useState(Date.now())
  const summary = summarizeDepartmentService(assignments)
  const visible = useMemo(() => filterDepartmentService(assignments, query, status), [assignments, query, status])

  const loadActiveSessions = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setActiveLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/community-service/active-sessions`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to load active service sessions.')
      setActiveSessions(Array.isArray(data.sessions) ? data.sessions : [])
      setActiveError('')
    } catch (loadError) {
      setActiveError(loadError.message || 'Unable to load active service sessions.')
    } finally {
      if (!quiet) setActiveLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadActiveSessions()
    const handleChange = () => { loadActiveSessions({ quiet: true }); onAttendanceUpdated?.() }
    realtimeSocket?.on('community-service:changed', handleChange)
    const refresh = window.setInterval(() => loadActiveSessions({ quiet: true }), 15000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearInterval(refresh); window.clearInterval(clock); realtimeSocket?.off('community-service:changed', handleChange) }
  }, [loadActiveSessions, onAttendanceUpdated, realtimeSocket])

  const updateTimeOut = (sessionId, field, value) => setTimeOutForms((current) => ({
    ...current,
    [sessionId]: { ...(current[sessionId] || emptyTimeOut), [field]: value }
  }))

  const timeOut = async (session) => {
    const form = timeOutForms[session.session_id] || emptyTimeOut
    if (!form.condition) return setActiveError('Select the student condition before time-out.')
    setBusySession(session.session_id)
    setActiveError('')
    try {
      const response = await fetch(`${API_URL}/api/community-service/attendance/time-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: Number(session.assignment_id), student_id: Number(session.student_id), condition: form.condition, notes: form.notes.trim() })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to record time-out.')
      setTimeOutForms((current) => { const next = { ...current }; delete next[session.session_id]; return next })
      await loadActiveSessions({ quiet: true })
      onAttendanceUpdated?.()
    } catch (timeOutError) {
      setActiveError(timeOutError.message || 'Unable to record time-out.')
    } finally {
      setBusySession(null)
    }
  }

  return <div className="department-service-page">
    <section className="department-welcome"><div><p className="eyebrow">Service oversight</p><h2>Community service</h2><p>Monitor active service time and assignments in your authenticated department.</p></div><button type="button" onClick={onOpenScanner}>Record time-in</button></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="table-card" aria-busy={activeLoading}>
      <div className="table-header"><div><p className="eyebrow">Live attendance</p><h3>Students currently serving</h3><p>Elapsed time updates every second. Time-Out immediately credits eligible minutes.</p></div><span>{activeSessions.length} active</span></div>
      {activeError && <p className="error-message" role="alert">{activeError}</p>}
      {activeLoading ? <div className="department-empty"><p>Loading active sessions…</p></div> : activeSessions.length === 0 ? <div className="department-empty"><h4>No students currently timed in</h4><p>Use QR Scan to record a student’s Time-In.</p></div> : <div className="service-assignment-list">{activeSessions.map((session) => { const form = timeOutForms[session.session_id] || emptyTimeOut; return <article key={session.session_id}><div className="service-assignment-heading"><div><h4>{session.first_name} {session.last_name}</h4><span>{session.student_number} · Assignment #{session.assignment_id}</span></div><strong aria-label="Live elapsed time">{formatLiveServiceTime(liveServiceSeconds(session.time_in, now))}</strong></div><p>Timed in: {new Date(session.time_in).toLocaleString()}</p><label>Student condition<select value={form.condition} onChange={(event) => updateTimeOut(session.session_id, 'condition', event.target.value)} disabled={busySession===session.session_id}><option value="">Select condition</option><option value="SATISFACTORY">Satisfactory</option><option value="NEEDS_FOLLOW_UP">Needs follow-up</option><option value="INCIDENT_REPORTED">Incident reported</option></select></label><label>Service note (optional)<textarea rows="2" maxLength="500" value={form.notes} onChange={(event) => updateTimeOut(session.session_id, 'notes', event.target.value)} disabled={busySession===session.session_id}/></label><button type="button" onClick={() => timeOut(session)} disabled={busySession===session.session_id || !form.condition}>{busySession===session.session_id?'Recording…':'Time out and credit hours'}</button></article> })}</div>}
    </section>
    <section className="stats-grid department-stats" aria-label="Community service summary"><article className="stat-card"><span>Assignments</span><strong>{summary.total}</strong></article><article className="stat-card"><span>Active</span><strong>{summary.active}</strong></article><article className="stat-card"><span>Completed</span><strong>{summary.completed}</strong></article><article className="stat-card"><span>Hours remaining</span><strong>{summary.remainingHours.toFixed(2)}</strong></article></section>
    <section className="student-roster-tools" aria-label="Filter service assignments"><label><span>Search students</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or student number" /></label><label><span>Assignment status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All assignments</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ADMIN_CLOSED">Administratively closed</option><option value="INVALID_CANCELLED">Invalid / cancelled</option></select></label></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">Scoped assignments</p><h3>Service progress</h3></div><span>{visible.length} records</span></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Loading service assignments…</p></div> : visible.length === 0 ? <div className="department-empty"><h4>No matching assignments</h4><p>Assignments appear after the Discipline Office assigns them to your department.</p></div> : <div className="service-assignment-list">{visible.map((item) => { const progress = serviceProgress(item); return <article key={item.id}><div className="service-assignment-heading"><div><h4>{item.first_name} {item.last_name}</h4><span>{item.student_number} · Assignment #{item.id}</span></div><span className="status-badge">{String(item.status).replaceAll('_', ' ')}</span></div><div className="service-progress-meta"><span>{Number(item.completed_hours || 0).toFixed(2)} of {Number(item.required_hours || 0).toFixed(2)} hours</span><strong>{progress}%</strong></div><div className="progress-track" role="progressbar" aria-label={`${item.first_name} ${item.last_name} service progress`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div><p>{Number(item.remaining_hours || 0).toFixed(2)} hours remaining</p></article> })}</div>}
    </section><p className="scope-note">Only your department’s assigned sessions are visible. The Discipline Office decides required hours; your department records attendance and credited time.</p>
  </div>
}
export default DepartmentCommunityService
