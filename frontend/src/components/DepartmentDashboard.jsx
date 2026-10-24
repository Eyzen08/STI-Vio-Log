import { formatDuration, summarizeDepartmentDtr } from '../lib/departmentDashboard.js'
import { formatDuration as formatHours, formatManilaDateTime, formatDisplayLabel } from '../lib/displayFormat.js'
import { attendanceOutcomeLabel } from '../lib/attendanceOutcome.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { serviceProgress, nearCompletionAssignments } from '../lib/serviceProgress.js'

export default function DepartmentDashboard({ report, loading, error, onOpenScanner, onNavigate, activeSessions=[], attendanceReady=false, attendanceError, departmentName }) {
  const rows = Array.isArray(report?.data) ? report.data : []
  const summary = summarizeDepartmentDtr(report)
  const serving = new Set(activeSessions.filter(isActiveServiceSession).map(row=>row.student_id)).size
  const near = nearCompletionAssignments(rows)
  const required = rows.reduce((sum,row)=>sum+(Number(row.required_hours)||0),0)
  const remaining = rows.reduce((sum,row)=>sum+(Number(row.remaining_hours)||0),0)
  const progress = serviceProgress(required,remaining)
  if (loading && !report) return <section className="dashboard-loading" aria-live="polite"><p>Loading department overview…</p><div className="skeleton skeleton-card"/></section>
  return <div className="department-dashboard department-page">
    <header className="portal-welcome portal-page-header"><div><h2>{departmentName || rows[0]?.department_name || 'Your Department'}</h2><p>Community Service and Attendance</p></div><div className="department-header-actions"><button type="button" onClick={onOpenScanner}>Scan QR</button><button className="secondary-button" type="button" onClick={()=>onNavigate?.('/department/dtr')}>View Attendance</button></div></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {attendanceError && <p className="error-message" role="alert">{attendanceError}</p>}
    <section className="department-metrics" aria-label="Department Attendance Summary">
      <article><span>Students Served</span><strong>{report ? summary.studentsServed : '—'}</strong></article>
      <article><span>Active Assignments</span><strong>{report ? summary.activeAssignments : '—'}</strong></article>
      <article><span>Students Timed In</span><strong>{attendanceReady ? serving : '—'}</strong></article>
      <article><span>Near Completion</span><strong>{report ? near.length : '—'}</strong></article>
    </section>
    <section className="department-dashboard-grid">
      <div className="department-dashboard-main">
        <article className="table-card"><header className="table-header"><h3>Recent Attendance</h3><button className="text-button" type="button" onClick={()=>onNavigate?.('/department/dtr')}>View All</button></header>
          {rows.length ? <div className="department-activity-list">{rows.slice(0,5).map(row=><article key={`${row.assignment_id}-${row.department_id}`}><div><strong>{row.first_name} {row.last_name}</strong><small>{row.student_number} · Assignment #{row.assignment_id}</small><time>{formatManilaDateTime(row.latest_attendance_at)}</time></div><div><span className="status-badge">{formatDisplayLabel(row.assignment_status)}</span><small>{attendanceOutcomeLabel(row.attendance_outcome)}</small></div></article>)}</div> : <p className="department-empty">{error ? 'Attendance records unavailable.' : 'No attendance recorded yet.'}</p>}
        </article>
        <section className="table-card"><header className="table-header"><div><h3>Near Completion</h3><p>Assignments with two hours or less remaining</p></div><button className="text-button" type="button" onClick={()=>onNavigate?.('/department/students')}>View Students</button></header>
          {near.length ? <div className="table-wrap"><table className="responsive-record-table"><thead><tr><th>Student</th><th>Assignment</th><th>Sessions</th><th>Credited</th><th>Remaining</th></tr></thead><tbody>{near.slice(0,6).map(row=><tr key={`${row.assignment_id}-${row.department_id}`}><td data-label="Student"><strong>{row.first_name} {row.last_name}</strong><small>{row.student_number}</small></td><td data-label="Assignment">#{row.assignment_id}</td><td data-label="Sessions">{row.total_completed_sessions}</td><td data-label="Credited">{formatDuration(row.total_credited_minutes)}</td><td data-label="Remaining"><strong>{formatHours(row.remaining_hours)}</strong></td></tr>)}</tbody></table></div> : <p className="department-empty">{error ? 'Service records unavailable.' : 'No assignments near completion.'}</p>}
        </section>
      </div>
      <article className="table-card department-progress-summary"><header className="table-header"><h3>Service Progress</h3><button type="button" className="text-button" onClick={()=>onNavigate?.('/department/community-service')}>View Service</button></header><strong>{report ? `${progress.percent}% credited` : 'Progress Unavailable'}</strong><progress max="100" value={progress.percent} aria-label="Department Service Progress"/><dl><div><dt>Required</dt><dd>{report ? formatHours(progress.required) : '—'}</dd></div><div><dt>Credited</dt><dd>{report ? formatHours(progress.completed) : '—'}</dd></div><div><dt>Remaining</dt><dd>{report ? formatHours(progress.remaining) : '—'}</dd></div></dl><p className="department-caption">Assignments with recorded department attendance</p></article>
    </section>
  </div>
}
