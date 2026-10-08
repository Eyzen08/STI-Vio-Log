import { useEffect, useState } from 'react'
import { formatDisplayLabel, formatDuration, formatManilaDate, formatManilaDateTime, formatManilaTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { attendanceRoster } from '../lib/attendanceStatus.js'
import Avatar from './Avatar.jsx'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import PortalIcon from './PortalIcon.jsx'
import campusImage from '../assets/sti-global-city-building-web.jpg'

const active = (status) => ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(status)
const resolved = (status) => ['COMPLETE', 'CLEAR'].includes(status)
const incident = (item) => item.incident_date ? `${String(item.incident_date).slice(0, 10)}T${String(item.incident_time || '00:00:00').slice(0, 8)}+08:00` : null

function IncidentTime({ item }) {
  return <time dateTime={incident(item) || undefined}>{formatManilaDate(incident(item))}<span>{item.incident_time ? formatManilaTime(incident(item)) : 'Time not recorded'}</span></time>
}

function AdminDashboard({ students = [], violations = [], assignments = [], activeSessions = [], loading, error, role, onNavigate, onViewViolation, attendanceReady = true, attendanceError }) {
  const visibleActiveSessions = activeSessions.filter(isActiveServiceSession)
  const roster = attendanceRoster(students, assignments, visibleActiveSessions).filter((student) => student.sessions.length)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!visibleActiveSessions.length) return undefined
    setNow(Date.now())
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [visibleActiveSessions.length])

  const openViolations = violations.filter((item) => active(item.status)).length
  const casesResolved = violations.filter((item) => resolved(item.status)).length
  const activeAssignments = assignments.filter((item) => active(item.status || 'OPEN')).length
  const timedIn = new Set(visibleActiveSessions.map((session) => Number(session.student_id))).size
  const required = assignments.reduce((sum, item) => sum + (Number(item.required_hours) || 0), 0)
  const remaining = assignments.reduce((sum, item) => sum + (Number(item.remaining_hours) || 0), 0)
  const completed = Math.max(0, required - remaining)
  const progress = required ? Math.min(100, Math.round(completed / required * 100)) : 0
  const firstLabel = role === 'DISCIPLINE_OFFICE' ? 'Discipline Officer' : 'Admin'
  const offenseBreakdown = [
    { level: 'MINOR_1', label: 'First offense', color: '#087cff' },
    { level: 'MINOR_2', label: 'Repeat minor', color: '#ffbd13' },
    { level: 'MAJOR_LEVEL', label: 'Major level', color: '#ff7028' },
    { level: 'GRAVE', label: 'Grave', color: '#f32e3e' }
  ].map((item) => ({ ...item, count: violations.filter((violation) => violation.offense_indicator_level === item.level).length }))
  const classifiedTotal = offenseBreakdown.reduce((sum, item) => sum + item.count, 0)
  const primaryMetrics = [
    ['violations', 'Open Violations', openViolations, 'Require review', 'red', '/admin/violations'],
    ['clock', 'Timed-in students', attendanceReady ? timedIn : '—', 'Currently on site', 'blue', '/admin/active-attendance'],
    ['students', 'Total Students', students.length, 'Registered records', 'blue', '/admin/students'],
    ['check', 'Resolved cases', casesResolved, 'Completed or cleared', 'green', '/admin/violations']
  ]
  const showValue = (value) => loading || error ? '—' : value

  return <div className="admin-dashboard portal-dashboard" aria-busy={loading}>
    <header className="dashboard-heading">
      <div className="portal-welcome portal-page-header" style={{ '--campus-image': `url(${campusImage})` }}>
        <div><h2>Dashboard</h2><p>Welcome back, {firstLabel}. Discipline Office overview.</p></div>
        <div className="dashboard-welcome-date"><PortalIcon name="calendar"/><time>{new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date())}</time></div>
      </div>
      <nav className="dashboard-primary-actions" aria-label="Dashboard actions">
        <button type="button" className="primary-action" onClick={() => onNavigate('/admin/qr-scan')}><PortalIcon name="qr"/>Scan QR</button>
        <button type="button" className="secondary-button" onClick={() => onNavigate('/admin/violations')}><PortalIcon name="violations"/>Issue violation</button>
      </nav>
    </header>
    {error && <p className="attendance-update-error" role="alert">{error}</p>}
    <section className="stats-grid admin-stats" aria-label="Priority administrative summary">
      {primaryMetrics.map(([icon, label, value, note, tone, path]) => <button type="button" className={`stat-card metric-${tone}`} key={label} onClick={() => onNavigate(path)}><i><PortalIcon name={icon}/></i><div><span>{label}</span><strong>{showValue(value)}</strong><small>{note}</small></div><PortalIcon name="chevron-right" className="metric-chevron"/></button>)}
    </section>
    <section className="admin-dashboard-grid">
        <section className="dashboard-card active-session-card">
          <header className="dashboard-section-heading"><h3>Active attendance</h3><button className="text-button" type="button" onClick={() => onNavigate('/admin/active-attendance')}>Manage attendance <span aria-hidden="true">→</span></button></header>
          {attendanceError && <p className="attendance-update-error" role="alert">{attendanceError}</p>}
          <div className="dashboard-attendance-content">
            <div className="dashboard-active-students">{!attendanceReady ? <p className="empty-state">{loading ? 'Loading attendance status…' : 'Attendance unavailable.'}</p> : roster.length ? roster.slice(0, 3).map((student) => <article className="dashboard-active-student" key={student.student_id}>
              <header className="dashboard-active-identity"><div className="dashboard-student"><Avatar identity={student}/><div><strong>{[student.first_name, student.last_name].filter(Boolean).join(' ') || student.student_name || `Student #${student.student_id}`}</strong><small>{student.student_number}</small></div></div><AttendanceIndicator sessions={student.sessions}/></header>
              <div className="dashboard-active-services">{student.sessions.map((session) => <div className="dashboard-active-service" key={session.session_id ?? session.id}>
                <div className="dashboard-session-info"><strong>{session.department_name || 'Department not recorded'}</strong><span>Assignment #{session.assignment_id}</span><small>Started: {formatManilaDateTime(session.time_in)}</small></div>
                <div className="dashboard-session-countdown"><span className="dashboard-session-label">{session.session_type === 'OPEN_TIME' && session.credit_cutoff_at ? 'Time elapsed' : 'Remaining session time'}</span><ServiceCountdown session={session} now={now}/></div>
              </div>)}</div>
            </article>) : <p className="empty-state">No students are currently serving.</p>}{attendanceReady && roster.length > 3 && <button className="text-button" type="button" onClick={() => onNavigate('/admin/active-attendance')}>View all {timedIn} timed-in students</button>}</div>
          </div>
        </section>
        <article className="dashboard-card admin-service-overview"><header className="dashboard-section-heading"><h3>Community service</h3><button className="text-button" type="button" onClick={() => onNavigate('/admin/community-service')}>View service <span aria-hidden="true">→</span></button></header><div className="dashboard-service-progress"><progress value={loading || error ? 0 : progress} max="100" aria-label="Community service completion"/><strong>{showValue(progress)}%</strong></div><dl className="dashboard-service-totals"><div><dt>Credited</dt><dd>{showValue(formatDuration(completed))}</dd></div><div><dt>Remaining</dt><dd>{showValue(formatDuration(remaining))}</dd></div><div><dt>Active assignments</dt><dd>{showValue(activeAssignments)}</dd></div></dl><button type="button" className="secondary-button dashboard-clearance-link" onClick={() => onNavigate('/admin/awaiting-clearance')}><PortalIcon name="clearance"/>Awaiting clearance <span aria-hidden="true">→</span></button></article>
        <article className="dashboard-card recent-violations-card">
          <header className="dashboard-section-heading"><h3>Recent violations</h3><button className="text-button" type="button" onClick={() => onNavigate('/admin/violations')}>View all <span aria-hidden="true">→</span></button></header>
          {!loading && !error && violations.length ? <div className="table-wrap" role="region" aria-label="Recent violation records" tabIndex="0"><table className="dashboard-violations-table"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><thead><tr><th scope="col">Student</th><th scope="col">Offense</th><th scope="col">Incident date</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">View</th></tr></thead><tbody>{violations.slice(0, 4).map((item) => <tr key={item.id}>
            <td data-label="Student"><div className="dashboard-student"><Avatar identity={{ student_name: item.student_name }}/><div><strong>{item.student_name || `Student #${item.student_id}`}</strong><small>{item.student_number}</small></div></div></td>
            <td data-label="Offense"><span className="dashboard-offense-text">{item.exact_offense || item.violation_type_name || item.violation_name || 'Recorded offense'}</span></td>
            <td data-label="Incident date"><IncidentTime item={item}/></td>
            <td data-label="Severity"><span className={`dashboard-severity severity-${String(item.severity).toLowerCase()}`}>{formatDisplayLabel(item.severity, 'Not recorded')}</span></td>
            <td data-label="Status"><span className={`status-badge status-${String(item.status).toLowerCase()}`}>{formatDisplayLabel(item.status)}</span></td>
            <td data-label="View"><button className="dashboard-record-action secondary-button" type="button" aria-label={`View violation ${item.id}`} onClick={() => onViewViolation(item)}>View</button></td>
          </tr>)}</tbody></table></div> : <p className="empty-state">{loading ? 'Loading violations…' : error ? 'Violations unavailable.' : 'No violations available.'}</p>}
        </article>
        <article className="dashboard-card offense-breakdown-card"><header className="dashboard-section-heading"><div><h3>Offense distribution</h3><p>{showValue(classifiedTotal)} classified cases</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/analytics')}>View analytics <span aria-hidden="true">→</span></button></header><dl className="offense-breakdown-content">{offenseBreakdown.map((item) => <div key={item.level} style={{ '--legend-color': item.color }}><dt><i/>{item.label}</dt><dd><progress aria-label={`${item.label}: ${item.count} of ${classifiedTotal} classified cases`} value={loading || error ? 0 : item.count} max={classifiedTotal || 1}/><span>{showValue(item.count)} <small>({showValue(classifiedTotal ? Math.round(item.count / classifiedTotal * 100) : 0)}%)</small></span></dd></div>)}</dl></article>
        <nav className="dashboard-card dashboard-secondary-actions" aria-label="Other dashboard actions"><h3>Other actions</h3><div><button type="button" className="secondary-button" onClick={() => onNavigate('/admin/students')}><PortalIcon name="students"/>Add student</button><button type="button" className="secondary-button" onClick={() => onNavigate('/admin/reports')}><PortalIcon name="reports"/>Generate report</button></div></nav>
    </section>
  </div>
}

export default AdminDashboard
