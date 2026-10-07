import { useEffect, useMemo, useState } from 'react'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'

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
      <div className="table-header management-table-header"><div><h3>Active sessions</h3><p>Timers count down remaining session time. Progress uses approved credited hours only.</p></div><span>{attendanceReady ? activeSessions.length : '—'} timed in</span></div>
      {attendanceError && <p className="attendance-update-error">{attendanceError}</p>}
      <div className="active-attendance-toolbar"><label><span>Search student or department</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, student number, or department" /></label></div>
      {!attendanceReady ? <p className="empty-state">{loading ? 'Loading active attendance…' : 'Attendance unavailable.'}</p> : !visibleSessions.length ? <p className="empty-state">{activeSessions.length ? 'No active sessions match this search.' : 'No students are currently timed in.'}</p> : <div className="table-wrap active-attendance-table-wrap"><table className="responsive-record-table active-attendance-table">
        <thead><tr><th>Student</th><th>Department</th><th>Supervising officer</th><th>Time in</th><th>Remaining session time</th><th>Service hours</th><th>Credited progress</th><th>Action</th></tr></thead>
        <tbody>{visibleSessions.map((session) => {
          const service = progressForSession(session)
          return <tr key={session.session_id}>
            <td data-label="Student"><strong>{session.first_name} {session.last_name}</strong><small>{session.student_number}</small><AttendanceIndicator sessions={[session]}/></td>
            <td data-label="Department">{session.department_name || session.department_code || 'Not assigned'}</td>
            <td data-label="Supervising Officer"><strong>{session.supervising_officer_first_name} {session.supervising_officer_last_name}</strong><small>{formatDisplayLabel(session.supervising_officer_role)}</small></td>
            <td data-label="Time in">{formatManilaDateTime(session.time_in)}</td>
            <td data-label="Remaining session time"><ServiceCountdown session={session} now={now} className="active-attendance-clock"/></td>
            <td data-label="Service hours"><span>{formatDuration(service.completed)} completed</span><small>{formatDuration(service.remaining)} remaining of {formatDuration(service.required)}</small></td>
            <td data-label="Credited progress"><div className="table-progress"><div><span style={{ width: `${service.progress}%` }} /></div><small>{service.progress}% credited</small></div></td>
            <td data-label="Action"><button type="button" className="secondary-button time-out-button" onClick={()=>setSelectedSession(session)}>Time Out</button><button type="button" className="text-button" onClick={()=>onNavigate('/admin/community-service')}>Assignment</button></td>
          </tr>
        })}</tbody>
      </table></div>}
    </section>
    {selectedSession&&<ServiceTimeOutDialog session={selectedSession} token={token} onClose={()=>setSelectedSession(null)} onSaved={onAttendanceSaved}/>}
  </div>
}
