import { useEffect, useMemo, useState } from 'react'
import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import { formatLiveServiceTime, isActiveServiceSession, liveServiceSeconds } from '../lib/departmentService.js'

const progressForSession = (session) => {
  const required = Math.max(0, Number(session.required_hours) || 0)
  const remaining = Math.max(0, Number(session.remaining_hours) || 0)
  const completed = session.completed_hours === null || session.completed_hours === undefined
    ? Math.max(0, required - remaining)
    : Math.min(required, Math.max(0, Number(session.completed_hours) || 0))
  return { required, completed, remaining, progress: required ? Math.min(100, Math.round((completed / required) * 100)) : 0 }
}

export default function AdminActiveAttendance({ sessions = [], loading = false, onRefresh, onNavigate }) {
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(Date.now())
  const activeSessions = useMemo(() => sessions.filter(isActiveServiceSession), [sessions])

  useEffect(() => {
    if (!activeSessions.length) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeSessions.length])

  useEffect(() => {
    if (!onRefresh) return undefined
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') onRefresh() }
    refreshWhenVisible()
    const poller = window.setInterval(refreshWhenVisible, 15000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(poller)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [onRefresh])

  const visibleSessions = activeSessions.filter((session) => {
    const term = query.trim().toLowerCase()
    return !term || [session.first_name, session.last_name, session.student_number, session.department_name, session.department_code].filter(Boolean).join(' ').toLowerCase().includes(term)
  })

  return <div className="active-attendance-page">
    <header className="management-page-header">
      <div><span className="page-breadcrumb">Home / Active Attendance</span><h2>Active Attendance</h2><p>Monitor every student currently timed in and their credited service progress.</p></div>
      <span className="live-status-badge"><i aria-hidden="true" /> Live monitoring</span>
    </header>
    <section className="table-card active-attendance-card">
      <div className="table-header management-table-header"><div><h3>Active sessions</h3><p>Timers show uncredited active time. Progress uses approved credited hours only.</p></div><span>{activeSessions.length} timed in</span></div>
      <div className="active-attendance-toolbar"><label><span>Search student or department</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, student number, or department" /></label></div>
      {loading && !activeSessions.length ? <p className="empty-state" role="status">Loading active attendance…</p> : !visibleSessions.length ? <p className="empty-state">{activeSessions.length ? 'No active sessions match this search.' : 'No students are currently timed in.'}</p> : <div className="table-wrap active-attendance-table-wrap"><table className="responsive-record-table active-attendance-table">
        <thead><tr><th>Student</th><th>Department</th><th>Supervising officer</th><th>Time in</th><th>Live timer</th><th>Service hours</th><th>Credited progress</th><th>Action</th></tr></thead>
        <tbody>{visibleSessions.map((session) => {
          const service = progressForSession(session)
          const elapsed = liveServiceSeconds(session.time_in, now)
          return <tr key={session.session_id}>
            <td data-label="Student"><strong>{session.first_name} {session.last_name}</strong><small>{session.student_number}</small></td>
            <td data-label="Department">{session.department_name || session.department_code || 'Not assigned'}</td>
            <td data-label="Supervising officer"><strong>{session.supervising_officer_first_name} {session.supervising_officer_last_name}</strong><small>{String(session.supervising_officer_role || '').replaceAll('_', ' ')}</small></td>
            <td data-label="Time in">{formatManilaDateTime(session.time_in)}</td>
            <td data-label="Live timer"><time className="active-attendance-clock" dateTime={`PT${elapsed}S`} aria-label={`${formatLiveServiceTime(elapsed)} elapsed`}>{formatLiveServiceTime(elapsed)}</time></td>
            <td data-label="Service hours"><span>{formatDuration(service.completed)} completed</span><small>{formatDuration(service.remaining)} remaining of {formatDuration(service.required)}</small></td>
            <td data-label="Credited progress"><div className="table-progress"><div><span style={{ width: `${service.progress}%` }} /></div><small>{service.progress}% credited</small></div></td>
            <td data-label="Action"><button type="button" className="secondary-button" onClick={() => onNavigate('/admin/community-service')}>Manage assignment</button></td>
          </tr>
        })}</tbody>
      </table></div>}
    </section>
  </div>
}
