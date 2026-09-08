import { formatDuration, summarizeDepartmentDtr } from '../lib/departmentDashboard.js'
import { formatDuration as formatHourDuration, formatManilaTime } from '../lib/displayFormat.js'
import PortalIcon from './PortalIcon.jsx'
import DashboardQuickActions from './DashboardQuickActions.jsx'
import { serviceProgress, nearCompletionAssignments } from '../lib/serviceProgress.js'

const displayTime = (value) => formatManilaTime(value, 'Not recorded')

function DepartmentDashboard({ report, loading, error, onOpenScanner, onNavigate }) {
  const rows = Array.isArray(report?.data) ? report.data : []
  const summary = summarizeDepartmentDtr(report)
  const departmentName = rows[0]?.department_name || 'Your Department'
  const timedIn = rows.filter((row) => row.active_session || row.time_out_at == null && row.time_in_at).length
  const nearCompletionRows = nearCompletionAssignments(rows)
  const nearCompletion = nearCompletionRows.length
  const missingTimeout = rows.filter((row) => row.time_in_at && !row.time_out_at).length
  const requiredHours = rows.reduce((sum, row) => sum + (Number(row.required_hours) || 0), 0)
  const remainingHours = rows.reduce((sum, row) => sum + (Number(row.remaining_hours) || 0), 0)
  const progress = requiredHours ? Math.min(100, Math.round(((requiredHours - remainingHours) / requiredHours) * 100)) : 0

  if (loading) return <section className="dashboard-loading" aria-live="polite"><div className="skeleton skeleton-heading"/><div className="stats-grid">{[1,2,3,4].map((item)=><div className="stat-card skeleton-card" key={item}/>)}</div></section>

  return <div className="department-dashboard portal-dashboard">
    <section className="portal-welcome"><div><h2>{departmentName} Dashboard</h2><p>Monitor student community service and attendance for your department.</p></div><time>{new Intl.DateTimeFormat('en-PH',{dateStyle:'long'}).format(new Date())}</time></section>
    <DashboardQuickActions role="DEPARTMENT_HEAD" onNavigate={(path) => path === '/department/qr-scan' ? onOpenScanner?.() : onNavigate?.(path)}/>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="stats-grid department-stats" aria-label="Department attendance summary">
      <article className="stat-card metric-blue"><i><PortalIcon name="students"/></i><div><span>Assigned students</span><strong>{summary.studentsServed}</strong><small>Your department only</small></div></article>
      <article className="stat-card metric-green"><i><PortalIcon name="students"/></i><div><span>Students timed in</span><strong>{timedIn}</strong><small>Currently on site</small></div></article>
      <article className="stat-card metric-orange"><i><PortalIcon name="service"/></i><div><span>Active assignments</span><strong>{summary.activeAssignments}</strong><small>With ongoing service</small></div></article>
      <article className="stat-card metric-purple"><i><PortalIcon name="hourglass"/></i><div><span>Near completion</span><strong>{nearCompletion}</strong><small>2 hours or less</small></div></article>
      <article className="stat-card metric-red"><i><PortalIcon name="clock"/></i><div><span>Missing time out</span><strong>{missingTimeout}</strong><small>Needs attention</small></div></article>
    </section>

    <section className="department-overview-grid">
      <article className="dashboard-card attendance-card"><header className="dashboard-section-heading"><div><h3>Today's attendance</h3><p>Latest department activity</p></div><button className="text-button" type="button" onClick={()=>onNavigate?.('/department/dtr')}>View all</button></header>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Time</th><th>Student</th><th>Activity</th><th>Status</th></tr></thead><tbody>{rows.slice(0,5).map((row,index)=><tr key={`${row.assignment_id}-${index}`}><td>{displayTime(row.latest_attendance_at || row.time_in_at)}</td><td><strong>{row.first_name} {row.last_name}</strong></td><td>{row.time_out_at ? 'Time out' : 'Time in'}</td><td><span className="status-badge">{row.time_out_at ? 'Completed' : 'On-going'}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">No attendance recorded today.</p>}</article>
      <article className="dashboard-card progress-ring-card"><header><h3>Service progress</h3></header><div className="progress-ring" style={{'--progress':`${progress * 3.6}deg`}}><strong>{progress}%</strong><span>Completed</span></div><dl><div><dt>Completed</dt><dd>{formatHourDuration(requiredHours-remainingHours)}</dd></div><div><dt>Remaining</dt><dd>{formatHourDuration(remainingHours)}</dd></div><div><dt>Total required</dt><dd>{formatHourDuration(requiredHours)}</dd></div></dl></article>
    </section>

    <section className="dashboard-card dashboard-table-card"><header className="dashboard-section-heading"><div><h3>Students near completion</h3><p>Prioritize students with the least remaining service time.</p></div></header>{nearCompletionRows.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student number</th><th>Sessions</th><th>Credited</th><th>Remaining</th><th>Progress</th></tr></thead><tbody>{nearCompletionRows.slice(0,6).map((row)=><tr key={row.assignment_id}><td><strong>{row.first_name} {row.last_name}</strong></td><td>{row.student_number}</td><td>{row.total_completed_sessions}</td><td>{formatDuration(row.total_credited_minutes)}</td><td>{formatHourDuration(row.remaining_hours)}</td><td><div className="mini-progress" role="progressbar" aria-label={`Service progress for ${row.first_name} ${row.last_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={serviceProgress(row.required_hours, row.remaining_hours).percent}><span style={{width:`${serviceProgress(row.required_hours, row.remaining_hours).percent}%`}}/></div></td></tr>)}</tbody></table></div> : <p className="empty-state">No assignments currently have two hours or less remaining.</p>}</section>
    <p className="scope-note">Dashboard data is restricted to your assigned department.</p>
  </div>
}

export default DepartmentDashboard
