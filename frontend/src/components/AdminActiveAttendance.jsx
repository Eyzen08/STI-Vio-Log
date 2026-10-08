import { useEffect, useMemo, useState } from 'react'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'
import '../styles/active-attendance.css'

const progressForSession = (session) => {
  const required = Math.max(0, Number(session.required_hours) || 0)
  const remaining = Math.max(0, Number(session.remaining_hours) || 0)
  const completed = session.completed_hours === null || session.completed_hours === undefined
    ? Math.max(0, required - remaining)
    : Math.min(required, Math.max(0, Number(session.completed_hours) || 0))
  return { required, completed, remaining, progress: required ? Math.min(100, Math.round((completed / required) * 100)) : 0 }
}

export default function AdminActiveAttendance({ sessions = [], loading = false, onNavigate, attendanceReady = true, attendanceError,token,onAttendanceSaved }) {
  const [query, setQuery] = useState('')
  const [selectedSession,setSelectedSession] = useState(null)
  const [now, setNow] = useState(Date.now())
  const activeSessions = useMemo(() => sessions.filter(isActiveServiceSession), [sessions])

  useEffect(() => {
    if (!activeSessions.length) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeSessions.length])


  const visibleSessions = activeSessions.filter((session) => {
    const term = query.trim().toLowerCase()
    return !term || [session.first_name, session.last_name, session.student_number, session.department_name, session.department_code].filter(Boolean).join(' ').toLowerCase().includes(term)
  })

  return <div className="active-attendance-page">
    <header className="management-page-header portal-page-header">
      <div><span className="page-breadcrumb">Home / Active Attendance</span><h2>Active Attendance</h2><p>Monitor every student currently timed in and their credited service progress.</p></div>
      <span className="live-status-badge"><i aria-hidden="true" /> Live monitoring</span>
    </header>
    <section className="table-card active-attendance-card">
      <div className="table-header management-table-header"><div><h3>Active sessions</h3><p>Live session time and approved credited service.</p></div><span className="attendance-session-count">{attendanceReady ? activeSessions.length : '—'} timed in</span></div>
      {attendanceError && <p className="attendance-update-error">{attendanceError}</p>}
      <div className="active-attendance-toolbar"><label><span>Search student or department</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, student number, or department" /></label></div>
      {!attendanceReady ? <p className="empty-state">{loading ? 'Loading active attendance…' : 'Attendance unavailable.'}</p> : !visibleSessions.length ? <p className="empty-state">{activeSessions.length ? 'No active sessions match this search.' : 'No students are currently timed in.'}</p> : <div className="table-wrap active-attendance-table-wrap"><table className="responsive-record-table active-attendance-table">
        <colgroup><col/><col/><col/><col/><col/><col/></colgroup>
        <thead><tr><th scope="col">Student</th><th scope="col">Department &amp; supervisor</th><th scope="col">Time in</th><th scope="col">Session time</th><th scope="col">Credited service</th><th scope="col">Actions</th></tr></thead>
        <tbody>{visibleSessions.map((session) => {
          const service = progressForSession(session)
          return <tr key={session.session_id}>
            <td data-label="Student"><div className="attendance-student"><strong>{session.first_name} {session.last_name}</strong><small>{session.student_number}</small><AttendanceIndicator sessions={[session]}/></div></td>
            <td data-label="Department & supervisor"><div className="attendance-supervision"><strong>{session.department_name || session.department_code || 'Not assigned'}</strong><div><span>{session.supervising_officer_first_name} {session.supervising_officer_last_name}</span><small>{formatDisplayLabel(session.supervising_officer_role)}</small></div></div></td>
            <td data-label="Time in"><span className="attendance-time-in">{formatManilaDateTime(session.time_in)}</span></td>
            <td data-label="Session time"><div className="session-clock"><span className="session-clock-label">{session.session_type==='OPEN_TIME' && session.credit_cutoff_at ? 'Time elapsed' : 'Remaining session time'}</span><ServiceCountdown session={session} now={now} className="active-attendance-clock"/></div></td>
            <td data-label="Credited service"><div className="attendance-credit"><strong>{formatDuration(service.completed)} credited</strong><small>of {formatDuration(service.required)} required</small><span>{formatDuration(service.remaining)} remaining</span><div className="table-progress"><div role="progressbar" aria-label={`Credited service for ${session.first_name} ${session.last_name}`} aria-valuenow={service.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${service.progress}%` }} /></div><small>{service.progress}% credited</small></div></div></td>
            <td data-label="Actions"><div className="attendance-actions"><button type="button" className="primary-row-action time-out-button" onClick={()=>setSelectedSession(session)}>Time Out</button><button type="button" className="text-button" onClick={()=>onNavigate('/admin/community-service')}>View assignment</button></div></td>
          </tr>
        })}</tbody>
      </table></div>}
    </section>
    {selectedSession&&<ServiceTimeOutDialog session={selectedSession} token={token} onClose={()=>setSelectedSession(null)} onSaved={onAttendanceSaved}/>}
  </div>
}
