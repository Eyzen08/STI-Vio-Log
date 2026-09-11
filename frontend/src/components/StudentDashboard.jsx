import { summarizeStudentDashboard } from '../lib/studentDashboard.js'
import { formatDuration, formatIncidentDateTime } from '../lib/displayFormat.js'
import OffenseIndicator from './OffenseIndicator.jsx'
import PortalIcon from './PortalIcon.jsx'
import DashboardQuickActions from './DashboardQuickActions.jsx'

const hours = (value) => Math.max(0, Number(value) || 0)

function StudentDashboard({ profile, violations = [], assignments = [], clearanceRecords = [], eligibility, loading, error, onNavigate }) {
  const summary = summarizeStudentDashboard({ violations, assignments, clearanceRecords, eligibility })
  const displayName = profile ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ') : 'Student'
  const firstName = profile?.first_name || 'Student'
  const requiredHours = assignments.reduce((total, item) => total + hours(item.required_hours), 0)
  const remainingHours = assignments.reduce((total, item) => total + hours(item.remaining_hours), 0)
  const completedHours = Math.max(0, requiredHours - remainingHours)
  const progress = requiredHours ? Math.min(100, Math.round((completedHours / requiredHours) * 100)) : 0
  const currentAssignment = assignments.find(({ status }) => ['OPEN', 'IN_PROGRESS'].includes(status)) || assignments[0]
  const offenseLevel = violations.find((item) => item.offense_indicator_level)?.offense_indicator_level || (summary.activeViolations ? 'MINOR_1' : 'NEUTRAL')
  const clearanceLabel = summary.clearanceStatus.replaceAll('_', ' ')

  if (loading) return <section className="dashboard-loading" aria-live="polite"><div className="skeleton skeleton-heading"/><div className="stats-grid">{[1,2,3,4].map((item)=><div className="stat-card skeleton-card" key={item}/>)}</div></section>

  return <div className="student-dashboard portal-dashboard">
    <section className="portal-welcome">
      <div><h2>Good day, {firstName}!</h2><p>Stay informed. Stay accountable. Keep moving forward.</p></div>
      <blockquote>“Better Choices<br/>A Brighter Tomorrow.”</blockquote>
    </section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    {summary.activeViolations > 0 && <section className="student-standing-alert"><OffenseIndicator level={offenseLevel}/><div><strong>{offenseLevel === 'MAJOR_LEVEL' ? 'Major-level status' : 'Requirements need attention'}</strong><span>Review your record and complete any remaining requirements.</span></div></section>}
    <DashboardQuickActions role="STUDENT" onNavigate={onNavigate}/>

    <section className="stats-grid student-stats" aria-label="Student status summary">
      <article className="stat-card metric-blue"><i><PortalIcon name="reports"/></i><div><span>Total violations</span><strong>{violations.length}</strong><small>{summary.activeViolations} currently open</small></div></article>
      <article className="stat-card metric-red"><i><PortalIcon name="clock"/></i><div><span>Required service time</span><strong>{formatDuration(requiredHours)}</strong><small>Across all assignments</small></div></article>
      <article className="stat-card metric-green"><i><PortalIcon name="check"/></i><div><span>Completed service time</span><strong>{formatDuration(completedHours)}</strong><small>{progress}% complete</small></div></article>
      <article className="stat-card metric-orange"><i><PortalIcon name="hourglass"/></i><div><span>Remaining time</span><strong>{formatDuration(remainingHours)}</strong><small>{summary.activeAssignments} active assignment{summary.activeAssignments === 1 ? '' : 's'}</small></div></article>
    </section>

    <section className="student-overview-grid">
      <article className="dashboard-card standing-card"><header><h3>My standing</h3></header><div className="standing-detail"><OffenseIndicator level={offenseLevel}/><strong>{summary.standing}</strong><p>{summary.activeViolations ? 'Complete your pending requirements to become eligible for clearance.' : 'Keep up the good work and maintain your standing.'}</p></div></article>
      <article className="dashboard-card service-progress-card"><header><h3>Service progress</h3><strong>{progress}% completed</strong></header><div className="progress-track" aria-label={`${progress}% completed`}><span style={{width:`${progress}%`}}/></div><dl><div><dt>Required</dt><dd>{formatDuration(requiredHours)}</dd></div><div><dt>Completed</dt><dd>{formatDuration(completedHours)}</dd></div><div><dt>Remaining</dt><dd>{formatDuration(remainingHours)}</dd></div></dl></article>
      <article className="dashboard-card clearance-summary-card"><header><h3>Clearance status</h3></header><div><i><PortalIcon name={clearanceLabel.includes('NOT') ? 'hourglass' : 'check'}/></i><strong>{clearanceLabel}</strong><span>{eligibility?.eligible ? 'You are ready for evaluation.' : 'Pending requirements must be completed.'}</span></div><button className="secondary-button" type="button" onClick={()=>onNavigate('/student/clearance')}>View details →</button></article>
      <article className="dashboard-card qr-summary-card"><header><h3>My QR code</h3></header><div><span className="qr-mini"><PortalIcon name="qr" size={42}/></span><p><strong>{displayName}</strong><span>{profile?.student_number || 'Student number'}</span><span>{[profile?.program, profile?.section].filter(Boolean).join(' – ')}</span></p></div><button type="button" onClick={()=>onNavigate('/student/qr')}><PortalIcon name="qr"/> Open my QR</button></article>
    </section>

    <section className="dashboard-card dashboard-table-card">
      <header className="dashboard-section-heading"><div><h3>Recent violations</h3><p>{currentAssignment?.department_name ? `Assigned to ${currentAssignment.department_name}` : 'Your latest discipline records'}</p></div><button className="text-button" type="button" onClick={()=>onNavigate('/student/violations')}>View all</button></header>
      {violations.length === 0 ? <p className="empty-state">No violations on record.</p> : <div className="table-wrap"><table className="responsive-record-table"><thead><tr><th>Date</th><th>Offense</th><th>Type</th><th>Status</th><th>Required service</th></tr></thead><tbody>{violations.slice(0,5).map((violation)=><tr key={violation.id}><td data-label="Date">{formatIncidentDateTime(violation.incident_date, violation.incident_time)}</td><td data-label="Offense"><strong>{violation.exact_offense || violation.violation_type_name || `Violation #${violation.id}`}</strong></td><td data-label="Type"><OffenseIndicator level={violation.offense_indicator_level || offenseLevel} compact/></td><td data-label="Status"><span className={`status-badge status-${String(violation.status).toLowerCase()}`}>{violation.status}</span></td><td data-label="Required service">{formatDuration(violation.required_service_hours)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}

export default StudentDashboard
