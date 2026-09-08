import { formatDuration, formatIncidentDateTime, formatManilaDateTime } from '../lib/displayFormat.js'
import OffenseIndicator from './OffenseIndicator.jsx'
import PortalIcon from './PortalIcon.jsx'

const active = (status) => ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(status)

function AdminDashboard({ students = [], violations = [], assignments = [], activeSessions = [], pendingRegistrations = 0, unreadMessages = 0, loading, role, onNavigate }) {
  const openViolations = violations.filter((item) => active(item.status)).length
  const nonCompliant = new Set(violations.filter((item) => active(item.status)).map((item) => item.student_id)).size
  const activeAssignments = assignments.filter((item) => active(item.status || 'OPEN')).length
  const timedIn = activeSessions.length
  const clearanceReady = assignments.filter((item) => Number(item.remaining_hours) <= 0 && !active(item.status)).length
  const required = assignments.reduce((sum,item)=>sum+(Number(item.required_hours)||0),0)
  const remaining = assignments.reduce((sum,item)=>sum+(Number(item.remaining_hours)||0),0)
  const completed = Math.max(0, required-remaining)
  const progress = required ? Math.min(100,Math.round(completed/required*100)) : 0
  const firstLabel = role === 'DISCIPLINE_OFFICE' ? 'Discipline Officer' : 'Admin'
  const metrics = [
    ['students','Total students',students.length,'Registered records','blue'],
    ['violations','Open violations',openViolations,'Requires review','red'],
    ['students','Non-compliant students',nonCompliant,'Needs follow-up','orange'],
    ['service','Active service assignments',activeAssignments,'Ongoing service','green'],
    ['clock','Students timed in',timedIn,'Currently on site','blue'],
    ['registrations','Pending registrations',pendingRegistrations,'Needs review','purple'],
    ['check','Clearance ready',clearanceReady,'For evaluation','green'],
    ['messages','Unread messages',unreadMessages,'From portal users','blue']
  ]

  return <div className="admin-dashboard portal-dashboard">
    <section className="portal-welcome"><div><h2>Welcome back, {firstLabel}!</h2><p>Here’s what’s happening at STI Global City today.</p></div><time>{new Intl.DateTimeFormat('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date())}</time></section>
    <section className="stats-grid admin-stats" aria-label="Administrative summary">{metrics.map(([icon,label,value,note,tone])=><article className={`stat-card metric-${tone}`} key={label}><i><PortalIcon name={icon}/></i><div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{note}</small></div></article>)}</section>
    <section className="admin-dashboard-grid">
      <article className="dashboard-card recent-violations-card"><header className="dashboard-section-heading"><div><h3>Recent violations</h3><p>Latest recorded student cases</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/violations')}>View all</button></header>{violations.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Offense</th><th>Date</th><th>Status</th></tr></thead><tbody>{violations.slice(0,5).map((item)=><tr key={item.id}><td><strong>{item.student_name || `Student #${item.student_id}`}</strong><small>{item.student_number}</small></td><td><span className="offense-table-type"><OffenseIndicator level={item.offense_indicator_level} compact/>{item.exact_offense || item.violation_type_name || 'Recorded offense'}</span></td><td>{formatIncidentDateTime(item.incident_date,item.incident_time)}</td><td><span className={`status-badge status-${String(item.status).toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">No violations available.</p>}</article>
      <article className="dashboard-card progress-ring-card admin-service-overview"><header className="dashboard-section-heading"><div><h3>Community service overview</h3><p>Overall completion</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/community-service')}>View all</button></header><div className="progress-ring" style={{'--progress':`${progress*3.6}deg`}}><strong>{progress}%</strong><span>{formatDuration(completed)} complete</span></div><dl><div><dt>Completed</dt><dd>{formatDuration(completed)}</dd></div><div><dt>Remaining</dt><dd>{formatDuration(remaining)}</dd></div><div><dt>Assignments</dt><dd>{activeAssignments}</dd></div></dl></article>
      <article className="dashboard-card recent-activity-card"><header className="dashboard-section-heading"><div><h3>Recent activity</h3><p>Updates requiring awareness</p></div></header><ul>{violations.slice(0,3).map((item)=><li key={item.id}><i><PortalIcon name="violations"/></i><div><strong>Violation {item.status?.toLowerCase()}</strong><span>{item.student_name || `Student #${item.student_id}`}</span></div></li>)}{pendingRegistrations>0&&<li><i><PortalIcon name="registrations"/></i><div><strong>Student registrations</strong><span>{pendingRegistrations} awaiting review</span></div></li>}</ul></article>
    </section>
    <section className="dashboard-card active-session-card"><header className="dashboard-section-heading"><div><h3>Active attendance sessions</h3><p>Students currently timed in, with their accountable supervising officer</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/admin/community-service')}>Manage attendance</button></header>{activeSessions.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Department</th><th>Supervising officer</th><th>Time in</th><th>Elapsed</th></tr></thead><tbody>{activeSessions.map((session)=><tr key={session.session_id}><td><strong>{session.first_name} {session.last_name}</strong><small>{session.student_number}</small></td><td>{session.department_name}</td><td>{session.supervising_officer_first_name} {session.supervising_officer_last_name}<small>{String(session.supervising_officer_role || '').replaceAll('_',' ')}</small></td><td>{formatManilaDateTime(session.time_in)}</td><td>{formatDuration(Number(session.elapsed_seconds || 0) / 3600)}</td></tr>)}</tbody></table></div> : <p className="empty-state">No students are currently timed in.</p>}</section>
    <section className="dashboard-card admin-quick-actions"><header><h3>Quick actions</h3></header><div><button type="button" onClick={()=>onNavigate('/admin/students')}><PortalIcon name="students"/>Add student</button><button type="button" onClick={()=>onNavigate('/admin/violations')}><PortalIcon name="violations"/>Issue violation</button><button type="button" onClick={()=>onNavigate('/admin/qr-scan')}><PortalIcon name="qr"/>Record attendance</button><button type="button" onClick={()=>onNavigate('/admin/registrations')}><PortalIcon name="registrations"/>Registration review{pendingRegistrations>0&&<b>{pendingRegistrations}</b>}</button><button type="button" onClick={()=>onNavigate('/admin/reports')}><PortalIcon name="reports"/>Generate report</button></div></section>
  </div>
}

export default AdminDashboard
