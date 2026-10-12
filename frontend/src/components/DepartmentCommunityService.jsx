import { useEffect, useMemo, useState } from 'react'
import { notificationTarget } from '../lib/studentNotifications.js'
import { API_URL } from '../lib/api.js'
import Modal from './Modal.jsx'
import { ServiceAssignmentContent } from './CommunityServiceManagement.jsx'
import { filterDepartmentService, isActiveServiceSession, serviceProgress, summarizeDepartmentService } from '../lib/departmentService.js'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'

import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'

import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'

function DepartmentCommunityService({ assignments=[], loading, error, onOpenScanner, token, onAttendanceUpdated, activeSessions=[], attendanceReady=false, attendanceLoading=false, attendanceError, now:fixedNow, searchParams = '', onCloseTarget, onOpenTarget }) {
  const target = notificationTarget(searchParams)
  const [viewingAssignment, setViewingAssignment] = useState(null)
  const [targetError, setTargetError] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selectedSession,setSelectedSession] = useState(null)
  const [clock, setClock] = useState(Date.now())
  const now = fixedNow ?? clock
  const summary = summarizeDepartmentService(assignments)
  const visible = useMemo(() => filterDepartmentService(assignments, query, status), [assignments, query, status])

  useEffect(() => {
    if (loading || target.invalid || !target.assignmentId) return
    const controller = new AbortController()
    const record = assignments.find((item) => String(item.id) === target.assignmentId)
    if (record) setViewingAssignment(record)
    else fetch(`${API_URL}/api/community-service/${target.assignmentId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || !data.assignment) throw new Error('Assignment unavailable')
        if (!controller.signal.aborted) setViewingAssignment(data.assignment)
      }).catch(() => { if (!controller.signal.aborted) setTargetError(true) })
    return () => controller.abort()
  }, [loading, target.invalid, target.assignmentId, assignments, token])

  useEffect(() => {
    if (!activeSessions.length || fixedNow != null) return undefined
    const timer = window.setInterval(() => setClock(Date.now()),1000)
    return () => window.clearInterval(timer)
  }, [activeSessions.length, fixedNow])

  const visibleActiveSessions = activeSessions.filter(isActiveServiceSession)

  return <div className="department-service-page department-page">
    <section className="department-welcome portal-page-header"><div><p className="eyebrow">Service Oversight</p><h2>Community Service</h2><p>Monitor active service time and assignments in your authenticated department.</p></div><button type="button" onClick={onOpenScanner}>Record Time-In</button></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    {(targetError || (!target.assignmentId && target.sessionId)) && <p className="error-message" role="alert">The requested record is unavailable or you no longer have access to it.</p>}
    <section className="table-card" aria-busy={attendanceLoading}>
      <div className="table-header"><div><p className="eyebrow">Live Attendance</p><h3>Students Currently Serving</h3><p>Timers stop at the credit cutoff. Staff must still record Time Out.</p></div><span>{visibleActiveSessions.length} active</span></div>
      {attendanceError && <p className="error-message" role="alert">{attendanceError}</p>}
      {attendanceLoading ? <div className="department-empty" aria-live="polite"><p>Loading active sessions…</p></div> : !attendanceReady ? <div className="department-empty"><p>Current attendance unavailable.</p></div> : visibleActiveSessions.length === 0 ? <div className="department-empty"><h4>No Students Currently Timed In</h4><p>Use QR Scan to record a student’s Time-In.</p></div> : <div className="service-assignment-list">{visibleActiveSessions.map((session) => { return <article key={session.session_id}><div className="service-assignment-heading"><div><h4>{session.first_name} {session.last_name}</h4><span>{session.student_number} · Assignment #{session.assignment_id}</span></div><div className="department-service-countdown"><AttendanceIndicator sessions={[session]}/><span>{session.session_type==='OPEN_TIME'?'Time Elapsed':'Remaining Session Time'}</span><ServiceCountdown session={session} now={now} className="department-session-clock"/></div></div><p>Timed In: {formatManilaDateTime(session.time_in)}</p><button type="button" className="time-out-button" onClick={()=>setSelectedSession(session)}>Time Out</button></article> })}</div>}
    </section>
    <section className="department-metrics" aria-label="Community Service Summary"><article className="stat-card"><span>Assignments</span><strong>{summary.total}</strong></article><article className="stat-card"><span>Active</span><strong>{summary.active}</strong></article><article className="stat-card"><span>Completed</span><strong>{summary.completed}</strong></article><article className="stat-card"><span>Time Remaining</span><strong>{formatDuration(summary.remainingHours)}</strong></article></section>
    <section className="student-roster-tools" aria-label="Filter Service Assignments"><label><span>Search Students</span><input type="search" name="department-service-student-filter" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Juan or 02000123456" /></label><label><span>Assignment Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All Assignments</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ADMIN_CLOSED">Administratively Closed</option><option value="INVALID_CANCELLED">Invalid / Cancelled</option></select></label></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">Scoped Assignments</p><h3>Service Progress</h3></div><span>{visible.length} records</span></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Loading service assignments…</p></div> : visible.length === 0 ? <div className="department-empty"><h4>{error ? 'Service Assignments Unavailable' : 'No Matching Assignments'}</h4><p>Assignments appear after the Discipline Office assigns them to your department.</p></div> : <div className="service-assignment-list">{visible.map((item) => { const progress = serviceProgress(item); return <article key={item.id}><div className="service-assignment-heading"><div><h4>{item.first_name} {item.last_name}</h4><span>{item.student_number} · Assignment #{item.id}</span></div><span className="status-badge">{formatDisplayLabel(item.status)}</span></div><div className="service-progress-meta"><span>{formatDuration(item.completed_hours)} of {formatDuration(item.required_hours)}</span><strong>{progress}%</strong></div><div className="progress-track" role="progressbar" aria-label={`${item.first_name} ${item.last_name} Service Progress`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div><p>{formatDuration(item.remaining_hours)} remaining</p><button type="button" onClick={() => onOpenTarget ? onOpenTarget(item.id) : setViewingAssignment(item)}>View Assignment</button></article> })}</div>}
    </section><p className="scope-note">Only your department’s assigned sessions are visible. The Discipline Office decides required hours; your department records attendance and credited time.</p>
    {selectedSession&&<ServiceTimeOutDialog session={selectedSession} token={token} onClose={()=>setSelectedSession(null)} onSaved={onAttendanceUpdated}/>}
    {viewingAssignment && <Modal title={`Service Assignment #${viewingAssignment.id}`} drawer onClose={() => { setViewingAssignment(null); onCloseTarget?.() }}><ServiceAssignmentContent assignment={viewingAssignment} token={token} targetSessionId={target.sessionId} /></Modal>}
  </div>
}
export default DepartmentCommunityService
