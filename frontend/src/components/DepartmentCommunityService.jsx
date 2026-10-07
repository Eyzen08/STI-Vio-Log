import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { filterDepartmentService, isActiveServiceSession, serviceProgress, summarizeDepartmentService } from '../lib/departmentService.js'
import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'

import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'

import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'

function DepartmentCommunityService({ assignments, loading, error, onOpenScanner, token, onAttendanceUpdated, realtimeSocket }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [activeSessions, setActiveSessions] = useState([])
  const [activeError, setActiveError] = useState('')
  const [activeLoading, setActiveLoading] = useState(true)
  const [selectedSession,setSelectedSession] = useState(null)
  const [now, setNow] = useState(Date.now())
  const activeRequestRef = useRef(false)
  const summary = summarizeDepartmentService(assignments)
  const visible = useMemo(() => filterDepartmentService(assignments, query, status), [assignments, query, status])

  const loadActiveSessions = useCallback(async ({ quiet = false } = {}) => {
    if (activeRequestRef.current) return
    activeRequestRef.current = true
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
      activeRequestRef.current = false
      if (!quiet) setActiveLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadActiveSessions()
    const handleChange = () => { loadActiveSessions({ quiet: true }); onAttendanceUpdated?.() }
    realtimeSocket?.on('community-service:changed', handleChange)
    realtimeSocket?.on('connect', handleChange)
    window.addEventListener('online',handleChange)
    const refresh = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadActiveSessions({ quiet: true })
      onAttendanceUpdated?.()
    }, 15000)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') handleChange() }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearInterval(refresh); window.clearInterval(clock); realtimeSocket?.off('community-service:changed', handleChange); realtimeSocket?.off('connect',handleChange); window.removeEventListener('online',handleChange); document.removeEventListener('visibilitychange', refreshWhenVisible) }
  }, [loadActiveSessions, onAttendanceUpdated, realtimeSocket])

  const visibleActiveSessions = activeSessions.filter(isActiveServiceSession)

  return <div className="department-service-page">
    <section className="department-welcome portal-page-header"><div><p className="eyebrow">Service oversight</p><h2>Community service</h2><p>Monitor active service time and assignments in your authenticated department.</p></div><button type="button" onClick={onOpenScanner}>Record time-in</button></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="table-card" aria-busy={activeLoading}>
      <div className="table-header"><div><p className="eyebrow">Live attendance</p><h3>Students currently serving</h3><p>Remaining session time updates every second. Time-Out immediately credits eligible minutes.</p></div><span>{visibleActiveSessions.length} active</span></div>
      {activeError && <p className="error-message" role="alert">{activeError}</p>}
      {activeLoading ? <div className="department-empty"><p>Loading active sessions…</p></div> : visibleActiveSessions.length === 0 ? <div className="department-empty"><h4>No students currently timed in</h4><p>Use QR Scan to record a student’s Time-In.</p></div> : <div className="service-assignment-list">{visibleActiveSessions.map((session) => { return <article key={session.session_id}><div className="service-assignment-heading"><div><h4>{session.first_name} {session.last_name}</h4><span>{session.student_number} · Assignment #{session.assignment_id}</span></div><div className="department-service-countdown"><AttendanceIndicator sessions={[session]}/><span>{session.session_type==='OPEN_TIME'?'Time elapsed':'Time remaining'}</span><ServiceCountdown session={session} now={now}/></div></div><p>Timed in: {formatManilaDateTime(session.time_in)}</p><button type="button" className="time-out-button" onClick={()=>setSelectedSession(session)}>Time Out</button></article> })}</div>}
    </section>
    <section className="stats-grid department-stats" aria-label="Community service summary"><article className="stat-card"><span>Assignments</span><strong>{summary.total}</strong></article><article className="stat-card"><span>Active</span><strong>{summary.active}</strong></article><article className="stat-card"><span>Completed</span><strong>{summary.completed}</strong></article><article className="stat-card"><span>Time remaining</span><strong>{formatDuration(summary.remainingHours)}</strong></article></section>
    <section className="student-roster-tools" aria-label="Filter service assignments"><label><span>Search students</span><input type="search" name="department-service-student-filter" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or student number" /></label><label><span>Assignment status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All assignments</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ADMIN_CLOSED">Administratively closed</option><option value="INVALID_CANCELLED">Invalid / cancelled</option></select></label></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">Scoped assignments</p><h3>Service progress</h3></div><span>{visible.length} records</span></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Loading service assignments…</p></div> : visible.length === 0 ? <div className="department-empty"><h4>No matching assignments</h4><p>Assignments appear after the Discipline Office assigns them to your department.</p></div> : <div className="service-assignment-list">{visible.map((item) => { const progress = serviceProgress(item); return <article key={item.id}><div className="service-assignment-heading"><div><h4>{item.first_name} {item.last_name}</h4><span>{item.student_number} · Assignment #{item.id}</span></div><span className="status-badge">{String(item.status).replaceAll('_', ' ')}</span></div><div className="service-progress-meta"><span>{formatDuration(item.completed_hours)} of {formatDuration(item.required_hours)}</span><strong>{progress}%</strong></div><div className="progress-track" role="progressbar" aria-label={`${item.first_name} ${item.last_name} service progress`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div><p>{formatDuration(item.remaining_hours)} remaining</p></article> })}</div>}
    </section><p className="scope-note">Only your department’s assigned sessions are visible. The Discipline Office decides required hours; your department records attendance and credited time.</p>
    {selectedSession&&<ServiceTimeOutDialog session={selectedSession} token={token} onClose={()=>setSelectedSession(null)} onSaved={async()=>{await loadActiveSessions({quiet:true});onAttendanceUpdated?.()}}/>}
  </div>
}
export default DepartmentCommunityService
