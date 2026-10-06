import { useEffect, useState } from 'react'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime, formatManilaDateTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { attendanceRoster } from '../lib/attendanceStatus.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import OffenseIndicator from './OffenseIndicator.jsx'
import PortalIcon from './PortalIcon.jsx'
import DashboardQuickActions from './DashboardQuickActions.jsx'

const active = (status) => ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(status)

function AdminDashboard({ students = [], violations = [], assignments = [], clearanceRecords = [], activeSessions = [], unreadMessages = 0, loading, role, onNavigate, onOpenGraphs, attendanceReady = true, attendanceError }) {
  const visibleActiveSessions = activeSessions.filter(isActiveServiceSession)
  const [attendanceQuery, setAttendanceQuery] = useState('')
  const roster = attendanceRoster(students, assignments, activeSessions, attendanceQuery)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!visibleActiveSessions.length) return undefined
    setNow(Date.now())
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [visibleActiveSessions.length])

  const openViolations = violations.filter((item) => active(item.status)).length
  const nonCompliant = new Set(violations.filter((item) => active(item.status)).map((item) => item.student_id)).size
  const activeAssignments = assignments.filter((item) => active(item.status || 'OPEN')).length
  const timedIn = new Set(visibleActiveSessions.map((session) => Number(session.student_id))).size
  const clearanceReady = clearanceRecords.filter((item) => item.status === 'PENDING').length
  const required = assignments.reduce((sum,item)=>sum+(Number(item.required_hours)||0),0)
  const remaining = assignments.reduce((sum,item)=>sum+(Number(item.remaining_hours)||0),0)
  const completed = Math.max(0, required-remaining)
  const progress = required ? Math.min(100,Math.round(completed/required*100)) : 0
  const firstLabel = role === 'DISCIPLINE_OFFICE' ? 'Discipline Officer' : 'Admin'
  const offenseBreakdown = [
    { level: 'MINOR_1', label: 'First offense', color: '#1681e8' },
    { level: 'MINOR_2', label: 'Repeat minor', color: '#f2b927' },
    { level: 'MAJOR_LEVEL', label: 'Major level', color: '#f0713f' },
    { level: 'GRAVE', label: 'Grave', color: '#d9364e' }
  ].map((item) => ({ ...item, count: violations.filter((violation) => violation.offense_indicator_level === item.level).length }))
  const classifiedTotal = offenseBreakdown.reduce((sum, item) => sum + item.count, 0)
  let offenseCursor = 0
  const offenseGradient = classifiedTotal ? `conic-gradient(${offenseBreakdown.map((item) => {
    const start = offenseCursor
    offenseCursor += (item.count / classifiedTotal) * 100
    return `${item.color} ${start}% ${offenseCursor}%`
  }).join(',')})` : 'conic-gradient(#dce6f0 0 100%)'
  const primaryMetrics = [
    ['students','Total students',students.length,'Registered records','blue'],
    ['violations','Open violations',openViolations,'Requires review','red'],
    ['clock','Students timed in',attendanceReady ? timedIn : '—','Currently on site','blue']
  ]
  const additionalMetrics = [
    ['students','Non-compliant students',nonCompliant,'Needs follow-up','orange'],
    ['service','Active service assignments',activeAssignments,'Ongoing service','green'],
    ['check','Clearance ready',clearanceReady,'For evaluation','green'],
    ['messages','Unread messages',unreadMessages,'From portal users','blue']
  ]
  const metricCard = ([icon,label,value,note,tone]) => <article className={`stat-card metric-${tone}`} key={label}><i><PortalIcon name={icon}/></i><div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{note}</small></div></article>

  return <div className="admin-dashboard portal-dashboard">
    <section className="portal-welcome portal-page-header"><div><h2>Welcome back, {firstLabel}!</h2><p>Here’s what’s happening at STI Global City today.</p></div><time>{new Intl.DateTimeFormat('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date())}</time></section>
    <section className="stats-grid admin-stats" aria-label="Priority administrative summary">{primaryMetrics.map(metricCard)}</section>
    <DashboardQuickActions role={role} onNavigate={onNavigate} onOpenGraphs={onOpenGraphs}/>
    <details className="dashboard-additional-metrics"><summary>View additional totals</summary><section className="stats-grid admin-stats" aria-label="Additional administrative totals">{additionalMetrics.map(metricCard)}</section></details>
    <section className="admin-dashboard-grid">
      <div className="admin-dashboard-primary">
        <article className="dashboard-card recent-violations-card"><header className="dashboard-section-heading"><div><h3>Recent Violations</h3><p>Latest recorded student cases</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/violations')}>View All</button></header>{violations.length ? <div className="table-wrap"><table className="responsive-record-table"><thead><tr><th>Student</th><th>Offense</th><th>Date</th><th>Status</th></tr></thead><tbody>{violations.slice(0,5).map((item)=><tr key={item.id}><td data-label="Student"><strong>{item.student_name || `Student #${item.student_id}`}</strong><small>{item.student_number}</small></td><td data-label="Offense"><span className="offense-table-type"><OffenseIndicator level={item.offense_indicator_level} compact/>{item.exact_offense || item.violation_type_name || 'Recorded offense'}</span></td><td data-label="Date">{formatIncidentDateTime(item.incident_date,item.incident_time)}</td><td data-label="Status"><span className={`status-badge status-${String(item.status).toLowerCase()}`}>{formatDisplayLabel(item.status)}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">No violations available.</p>}</article>
        <section className="dashboard-card active-session-card">
          <header className="dashboard-section-heading"><div><h3>Current attendance status</h3><p>TIME IN and TIME OUT for students with service assignments</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/active-attendance')}>Manage attendance</button></header>
          <div className="attendance-roster-toolbar"><label>Search student or department<input type="search" value={attendanceQuery} onChange={(event) => setAttendanceQuery(event.target.value)} placeholder="Name, student number, or department"/></label></div>
          {attendanceError && <p className="attendance-update-error">{attendanceError}</p>}
          {loading && !attendanceReady ? <p className="empty-state">Loading attendance status…</p> : !attendanceReady ? <p className="empty-state">Attendance unavailable.</p> : roster.length ? <div className="table-wrap"><table className="responsive-record-table attendance-roster-table">
            <thead><tr><th>Student</th><th>Attendance status</th><th>Active service</th></tr></thead>
            <tbody>{roster.map((student) => <tr key={student.student_id}>
              <td data-label="Student"><strong>{student.first_name} {student.last_name}</strong><small>{student.student_number}</small></td>
              <td data-label="Attendance status"><AttendanceIndicator sessions={student.sessions} details/></td>
              <td data-label="Active service">{student.sessions.length ? student.sessions.map((session) => <div className="attendance-roster-session" key={session.session_id}>
                <strong>{session.department_name || 'Department not recorded'} · Assignment #{session.assignment_id}</strong>
                <small>Supervising officer: {[session.supervising_officer_first_name, session.supervising_officer_last_name].filter(Boolean).join(' ') || 'Not recorded'}</small>
                <small>Time in: {formatManilaDateTime(session.time_in)}</small>
                <span className="attendance-roster-countdown"><span>Remaining session time</span><ServiceCountdown session={session} now={now}/></span>
              </div>) : <span>Not currently serving</span>}</td>
            </tr>)}</tbody>
          </table></div> : <p className="empty-state">{attendanceQuery ? 'No students match this search.' : 'No students have service assignments.'}</p>}
        </section>
      </div>
      <div className="admin-dashboard-secondary">
        <article className="dashboard-card offense-breakdown-card"><header className="dashboard-section-heading"><div><h3>Offense breakdown</h3><p>Classification across recorded cases</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/reports')}>Reports</button></header><div className="offense-breakdown-content"><div className="offense-donut" style={{'--offense-gradient':offenseGradient}} role="img" aria-label={`${classifiedTotal} classified violation records`}><strong>{classifiedTotal}</strong><span>Classified</span></div><dl>{offenseBreakdown.map((item)=><div key={item.level}><dt><i style={{'--legend-color':item.color}}/>{item.label}</dt><dd>{item.count}</dd></div>)}</dl></div></article>
        <article className="dashboard-card progress-ring-card admin-service-overview"><header className="dashboard-section-heading"><div><h3>Community service overview</h3><p>Overall completion</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/community-service')}>View all</button></header><div className="progress-ring" style={{'--progress':`${progress*3.6}deg`}}><strong>{progress}%</strong><span>{formatDuration(completed)} complete</span></div><dl><div><dt>Completed</dt><dd>{formatDuration(completed)}</dd></div><div><dt>Remaining</dt><dd>{formatDuration(remaining)}</dd></div><div><dt>Assignments</dt><dd>{activeAssignments}</dd></div></dl></article>
        <article className="dashboard-card recent-activity-card"><header className="dashboard-section-heading"><div><h3>Recent activity</h3><p>Updates requiring awareness</p></div></header><ul>{violations.slice(0,3).map((item)=><li key={item.id}><i><PortalIcon name="violations"/></i><div><strong>Violation {item.status?.toLowerCase()}</strong><span>{item.student_name || `Student #${item.student_id}`}</span></div></li>)}</ul></article>
      </div>
    </section>
  </div>
}

export default AdminDashboard
