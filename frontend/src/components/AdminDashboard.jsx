import { useEffect, useState } from 'react'
import { formatDisplayLabel, formatDuration, formatManilaDate, formatManilaDateTime, formatManilaTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { attendanceRoster } from '../lib/attendanceStatus.js'
import Avatar from './Avatar.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import PortalIcon from './PortalIcon.jsx'
import DashboardQuickActions from './DashboardQuickActions.jsx'
import campusImage from '../assets/sti-global-city-building-web.jpg'

const active = (status) => ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(status)
const resolved = (status) => ['COMPLETE', 'CLEAR'].includes(status)
const incident = (item) => item.incident_date ? `${String(item.incident_date).slice(0, 10)}T${String(item.incident_time || '00:00:00').slice(0, 8)}+08:00` : null

function IncidentTime({ item }) {
  return <time dateTime={incident(item) || undefined}>{formatManilaDate(incident(item))}<span>{item.incident_time ? formatManilaTime(incident(item)) : 'Time not recorded'}</span></time>
}

function AdminDashboard({ students = [], violations = [], assignments = [], activeSessions = [], loading, error, role, onNavigate, attendanceReady = true, attendanceError }) {
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
  let offenseCursor = 0
  const offenseGradient = classifiedTotal ? `conic-gradient(${offenseBreakdown.map((item) => {
    const start = offenseCursor
    offenseCursor += (item.count / classifiedTotal) * 100
    return `${item.color} ${start}% ${offenseCursor}%`
  }).join(',')})` : 'conic-gradient(#dce6f0 0 100%)'
  const primaryMetrics = [
    ['students', 'Total Students', students.length, 'Registered records', 'blue', '/admin/students'],
    ['violations', 'Open Violations', openViolations, 'Require review', 'red', '/admin/violations'],
    ['clock', 'Students Timed In', attendanceReady ? timedIn : '—', 'Currently on site', 'blue', '/admin/active-attendance'],
    ['check', 'Cases Resolved', casesResolved, 'Completed or cleared', 'green', '/admin/violations']
  ]
  const showValue = (value) => loading || error ? '—' : value

  return <div className="admin-dashboard portal-dashboard" aria-busy={loading}>
    <section className="portal-welcome portal-page-header" style={{ '--campus-image': `url(${campusImage})` }}>
      <div><h2>Welcome back, {firstLabel}! <span aria-hidden="true">👋</span></h2><p>Here's what's happening at STI Global City today.</p></div>
      <div className="dashboard-welcome-date"><i><PortalIcon name="calendar"/></i><div><time>{new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}</time><small>Stay updated and keep the campus safe.</small></div></div>
    </section>
    {error && <p className="attendance-update-error" role="alert">{error}</p>}
    <section className="stats-grid admin-stats" aria-label="Priority administrative summary">
      {primaryMetrics.map(([icon, label, value, note, tone, path]) => <button type="button" className={`stat-card metric-${tone}`} key={label} onClick={() => onNavigate(path)}><i><PortalIcon name={icon}/></i><div><span>{label}</span><strong>{showValue(value)}</strong><small>{note}</small></div><PortalIcon name="chevron-right" className="metric-chevron"/></button>)}
    </section>
    <DashboardQuickActions role={role} onNavigate={onNavigate}/>
    <section className="admin-dashboard-grid">
      <div className="admin-dashboard-primary">
        <article className="dashboard-card recent-violations-card">
          <header className="dashboard-section-heading"><div><h3>Recent Violations</h3><p>Latest recorded student cases</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/violations')}>View All</button></header>
          {violations.length ? <div className="table-wrap"><table className="dashboard-violations-table"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><thead><tr><th>Student</th><th>Violation</th><th>Date &amp; Time</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead><tbody>{violations.slice(0, 4).map((item) => <tr key={item.id}>
            <td><div className="dashboard-student"><Avatar identity={{ student_name: item.student_name }}/><div><strong>{item.student_name || `Student #${item.student_id}`}</strong><small>{item.student_number}</small></div></div></td>
            <td><span className="dashboard-offense-text" title={item.exact_offense || item.violation_type_name}>{item.exact_offense || item.violation_type_name || 'Recorded offense'}</span></td>
            <td><IncidentTime item={item}/></td>
            <td><span className={`dashboard-severity severity-${String(item.severity).toLowerCase()}`}>{formatDisplayLabel(item.severity, 'Not recorded')}</span></td>
            <td><span className={`status-badge status-${String(item.status).toLowerCase()}`}>{formatDisplayLabel(item.status)}</span></td>
            <td><button className="dashboard-record-action" type="button" aria-label={`Manage violation for ${item.student_name || `Student #${item.student_id}`}`} onClick={() => onNavigate('/admin/violations')}><PortalIcon name="more"/></button></td>
          </tr>)}</tbody></table></div> : <p className="empty-state">{loading ? 'Loading violations…' : error ? 'Violations unavailable.' : 'No violations available.'}</p>}
        </article>
        <section className="dashboard-card active-session-card">
          <header className="dashboard-section-heading"><div><h3>Current Attendance Status</h3><p>Students currently serving community service</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/active-attendance')}>Manage Attendance</button></header>
          {attendanceError && <p className="attendance-update-error" role="alert">{attendanceError}</p>}
          <div className="dashboard-attendance-content">
            <div className="dashboard-attendance-totals"><div><i><PortalIcon name="students"/></i><span><strong>{showValue(attendanceReady ? timedIn : '—')}</strong><small>Currently Timed In</small></span></div><div><i><PortalIcon name="service"/></i><span><strong>{showValue(activeAssignments)}</strong><small>Active Assignments</small></span></div></div>
            <div className="dashboard-active-students">{!attendanceReady ? <p className="empty-state">{loading ? 'Loading attendance status…' : 'Attendance unavailable.'}</p> : roster.length ? roster.slice(0, 3).map((student) => <article className="dashboard-active-student" key={student.student_id}>
              <div className="dashboard-student"><Avatar identity={student}/><div><strong>{[student.first_name, student.last_name].filter(Boolean).join(' ') || student.student_name || `Student #${student.student_id}`}</strong><small>{student.student_number}</small></div></div>
              <div className="dashboard-active-services">{student.sessions.map((session) => <div className="dashboard-active-service" key={session.session_id ?? session.id}>
                <div><span className="dashboard-timed-in">TIMED IN</span><strong>{session.department_name || 'Department not recorded'} · Assignment #{session.assignment_id}</strong><small>Started: {formatManilaDateTime(session.time_in)}</small></div>
                <div className="dashboard-session-countdown"><span>Remaining Time</span><ServiceCountdown session={session} now={now}/></div>
              </div>)}</div>
            </article>) : <p className="empty-state">No students are currently serving.</p>}{attendanceReady && roster.length > 3 && <button className="text-button" type="button" onClick={() => onNavigate('/admin/active-attendance')}>View all {timedIn} timed-in students</button>}</div>
          </div>
        </section>
      </div>
      <div className="admin-dashboard-secondary">
        <article className="dashboard-card offense-breakdown-card"><header className="dashboard-section-heading"><div><h3>Offense Breakdown</h3><p>Classification across recorded cases</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/analytics')}>View Details</button></header><div className="offense-breakdown-content"><div className="offense-donut" style={{ '--offense-gradient': offenseGradient }} role="img" aria-label={`${classifiedTotal} classified violation records`}><strong>{showValue(classifiedTotal)}</strong><span>Cases</span></div><dl>{offenseBreakdown.map((item) => <div key={item.level}><dt><i style={{ '--legend-color': item.color }}/>{item.label}</dt><dd>{showValue(item.count)}<span>{showValue(classifiedTotal ? Math.round(item.count / classifiedTotal * 100) : 0)}%</span></dd></div>)}</dl></div></article>
        <article className="dashboard-card admin-service-overview"><header className="dashboard-section-heading"><div><h3>Community Service Overview</h3><p>Overall completion</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/community-service')}>View Details</button></header><div className="dashboard-service-progress"><progress value={progress} max="100" aria-label="Community service completion"/><strong>{showValue(progress)}%</strong></div><div className="dashboard-service-totals"><span>{showValue(formatDuration(completed))} completed</span><span>{showValue(formatDuration(remaining))} remaining</span><span>{showValue(activeAssignments)} Assignments</span></div></article>
        <article className="dashboard-card recent-activity-card">
          <header className="dashboard-section-heading"><div><h3>Recent case summary</h3><p>Current status · incident dates shown</p></div><button className="text-button" type="button" onClick={() => onNavigate('/admin/violations')}>View All</button></header>
          {violations.length ? <ul>{violations.slice(0, 3).map((item) => <li key={item.id}>
            <i className={resolved(item.status) ? 'activity-complete' : ''}><PortalIcon name={resolved(item.status) ? 'check' : 'violations'}/></i>
            <div className="case-details"><strong>{item.student_name || `Student #${item.student_id}`}</strong><span className="case-offense">{item.exact_offense || item.violation_name || 'Recorded offense'}</span></div>
            <div className="case-meta"><span className={`status-badge status-${String(item.status).toLowerCase()}`}>{formatDisplayLabel(item.status)}</span><IncidentTime item={item}/></div>
          </li>)}</ul> : <p className="empty-state">{loading ? 'Loading cases…' : error ? 'Cases unavailable.' : 'No recent cases.'}</p>}
        </article>
      </div>
    </section>
  </div>
}

export default AdminDashboard
