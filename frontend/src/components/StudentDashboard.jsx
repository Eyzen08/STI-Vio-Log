import { summarizeStudentDashboard } from '../lib/studentDashboard.js'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime } from '../lib/displayFormat.js'
import { parseViolationDescription } from '../lib/violationAdmin.js'
import OffenseIndicator from './OffenseIndicator.jsx'
import PortalIcon from './PortalIcon.jsx'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import StudentAttendancePanel from './StudentAttendancePanel.jsx'
import '../styles/student-portal.css'

const hours = (value) => Math.max(0, Number(value) || 0)

function StudentDashboard({ profile, violations = [], assignments = [], clearanceRecords = [], eligibility, dtr, loading, error, onNavigate, attendanceError }) {
  const summary = summarizeStudentDashboard({ violations, assignments, clearanceRecords, eligibility })
  const requiredHours = assignments.reduce((total, item) => total + hours(item.required_hours), 0)
  const remainingHours = assignments.reduce((total, item) => total + hours(item.remaining_hours), 0)
  const completedHours = Math.max(0, requiredHours - remainingHours)
  const progress = requiredHours ? Math.min(100, Math.round(completedHours / requiredHours * 100)) : 0
  const offenseLevel = violations.find((item) => item.offense_indicator_level)?.offense_indicator_level || (summary.activeViolations ? 'MINOR_1' : 'NEUTRAL')

  if (loading && !dtr) return <section className="student-page dashboard-loading" aria-live="polite"><AttendanceIndicator ready={false} loading/><div className="skeleton skeleton-heading"/></section>

  return <div className="student-page student-dashboard">
    <header className="portal-page-header student-page-heading"><div><h2>Good day, {profile?.first_name || 'Student'}!</h2><p>Your attendance, service progress, and school record.</p></div><div className="student-shortcuts"><button type="button" className="student-primary-button" onClick={()=>onNavigate('/student/qr')}><PortalIcon name="qr"/>My QR code</button><button type="button" className="student-secondary-button" onClick={()=>onNavigate('/student/messages')}><PortalIcon name="messages"/>Message Office</button></div></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    <StudentAttendancePanel sessions={dtr?.sessions || []} ready={Array.isArray(dtr?.sessions)} loading={loading} error={attendanceError}/>
    <div className="student-dashboard-summary">
      <section className="student-section student-progress-summary">
        <header className="student-section-heading"><h3>Service progress</h3><span>{progress}% credited</span></header>
        <div className="progress-track" role="progressbar" aria-label="Credited service progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div>
        <dl className="student-totals"><div><dt>Required</dt><dd>{formatDuration(requiredHours)}</dd></div><div><dt>Credited</dt><dd>{formatDuration(completedHours)}</dd></div><div><dt>Remaining</dt><dd><strong>{formatDuration(remainingHours)}</strong></dd></div></dl>
        <footer><span>{summary.activeAssignments} active assignment{summary.activeAssignments === 1 ? '' : 's'}</span><button type="button" className="text-button" onClick={()=>onNavigate('/student/community-service')}>View service</button></footer>
      </section>
      <section className="student-section student-standing-summary"><h3>Standing &amp; clearance</h3><OffenseIndicator level={offenseLevel}/><strong>{summary.standing}</strong><p className={summary.standing === 'Good standing' ? 'student-clearance-ready' : 'student-clearance-pending'}>{formatDisplayLabel(summary.clearanceStatus)}</p><button type="button" className="text-button" onClick={()=>onNavigate('/student/clearance')}>View clearance</button></section>
    </div>
    <section className="student-section">
      <header className="student-section-heading"><div><h3>Recent violations</h3><p>{violations.length} records · {summary.activeViolations} open</p></div><button type="button" className="text-button" onClick={()=>onNavigate('/student/violations')}>View all</button></header>
      {!violations.length ? <p className="student-empty">No violations on record.</p> : <div className="student-recent-list">{violations.slice(0,3).map((violation)=><article className="student-recent-record" key={violation.id}><div><strong>{violation.exact_offense || parseViolationDescription(violation.description || '').exact_offense || violation.violation_type_name || violation.violation_name || `Violation #${violation.id}`}</strong><span>{formatIncidentDateTime(violation.incident_date,violation.incident_time)}</span></div><span className={`status-badge status-${String(violation.status).toLowerCase()}`}>{formatDisplayLabel(violation.status)}</span><span>{formatDuration(violation.required_service_hours)} required</span></article>)}</div>}
    </section>
  </div>
}
export default StudentDashboard
