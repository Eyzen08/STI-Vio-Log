import { useState } from 'react'
import { notificationTarget } from '../lib/studentNotifications.js'
import RecordTargetFocus from './RecordTargetFocus.jsx'
import { formatMinutes, summarizeStudentService, validateDateRange } from '../lib/studentService.js'
import { formatDisplayLabel, formatManilaDateTime } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { attendanceOutcomeLabel } from '../lib/attendanceOutcome.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import StudentAttendancePanel from './StudentAttendancePanel.jsx'
import ServiceHourCorrections from './ServiceHourCorrections.jsx'
import '../styles/student-portal.css'

const dateTime = (value) => formatManilaDateTime(value, '—')

function StudentCommunityService({ dtr, liveDtr, loading, error, onFilter, attendanceError, onNavigate, searchParams = '' }) {
  const target = notificationTarget(searchParams)
  const [filters, setFilters] = useState({ from: '', to: '' })
  const [filterError, setFilterError] = useState('')
  const summary = summarizeStudentService(liveDtr || dtr)
  const assignments = Array.isArray(dtr?.assignments) ? dtr.assignments : []
  const sessionDtr = target.sessionId ? liveDtr || dtr : dtr
  const sessions = Array.isArray(sessionDtr?.sessions) ? sessionDtr.sessions : []
  const latestSessions = Array.isArray(liveDtr?.sessions) ? liveDtr.sessions : sessions
  const latestById = new Map(latestSessions.map((session) => [session.id, session]))
  const matchesTargetAssignment = (session) => !target.sessionId || !target.assignmentId || String(session.id) !== target.sessionId || String(session.assignment_id) === target.assignmentId
  const filteredSessions = sessions.filter(matchesTargetAssignment).map((session) => latestById.get(session.id) || session)
  const filteredIds = new Set(filteredSessions.map((session) => session.id))
  const currentSessions = latestSessions.filter(matchesTargetAssignment).filter(isActiveServiceSession).filter((session) => !filteredIds.has(session.id))
  const displaySessions = [...currentSessions, ...filteredSessions]
  const submitFilters = (event) => {
    event.preventDefault()
    const validationError = validateDateRange(filters)
    setFilterError(validationError)
    if (!validationError) onFilter(filters)
  }
  if (loading && !dtr) return <section className="student-page" aria-live="polite"><AttendanceIndicator ready={false} loading/><div className="skeleton service-heading-skeleton"/></section>

  return <section className="student-page student-service-page" aria-labelledby="service-title">
    <RecordTargetFocus id={target.invalid ? null : target.sessionId ? `service-session-${target.sessionId}` : target.assignmentId ? `service-assignment-${target.assignmentId}` : null} loading={loading} error={error} />
    <header className="portal-page-header student-page-heading"><div><h2 id="service-title">My service &amp; attendance</h2><p>Track credited hours and attendance.</p></div>{onNavigate && <button className="student-primary-button" type="button" onClick={()=>onNavigate('/student/qr')}>My QR code</button>}</header>
    {(error || filterError) && <p className="error-message" role="alert">{filterError || error}</p>}
    <StudentAttendancePanel sessions={liveDtr?.sessions || []} ready={Array.isArray(liveDtr?.sessions)} loading={loading} error={attendanceError}/>
    <section className="student-section" aria-label="Community-service summary"><dl className="student-totals"><div><dt>Required</dt><dd>{formatMinutes(summary.requiredMinutes)}</dd></div><div><dt>Credited</dt><dd>{formatMinutes(summary.creditedMinutes)}</dd></div><div><dt>Remaining</dt><dd><strong>{formatMinutes(summary.remainingMinutes)}</strong></dd></div></dl></section>
    <section className="student-section">
      <header className="student-section-heading"><h3>Assignments</h3><span>{assignments.length} records</span></header>
      {!assignments.length ? <p className="student-empty">No community-service assignments.</p> : <div className="student-assignment-list">{assignments.map((assignment)=>{
        const required=Number(assignment.required_minutes)||0, credited=Number(assignment.credited_minutes)||0
        const percentage=required ? Math.min(100,Math.round(credited/required*100)) : 100
        return <article key={assignment.assignment_id} id={`service-assignment-${assignment.assignment_id}`} tabIndex={-1}><header><div><strong>{assignment.department_name || assignment.department_code || `Assignment #${assignment.assignment_id}`}</strong><span>Assignment #{assignment.assignment_id} · Violation #{assignment.violation_id}</span><span>{assignment.department_head_first_name || assignment.department_head_last_name ? `Department Head: ${assignment.department_head_first_name || ''} ${assignment.department_head_last_name || ''}`.trim() : 'Department Head not recorded'}</span></div><span className="status-badge">{formatDisplayLabel(assignment.status)}</span></header><div className="student-assignment-credit"><span>{formatMinutes(credited)} credited of {formatMinutes(required)}</span><span>{formatMinutes(assignment.remaining_minutes)} remaining</span></div><div className="progress-track" role="progressbar" aria-label={`Assignment #${assignment.assignment_id} credited progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}><span style={{width:`${percentage}%`}}/></div><small>{percentage}% credited</small></article>
      })}</div>}
    </section>
    <details className="student-corrections"><summary>Hour corrections</summary><ServiceHourCorrections corrections={dtr?.hourCorrections || []}/></details>
    <section className="student-section student-dtr" aria-labelledby="student-dtr-title">
      <header className="student-section-heading"><div><h3 id="student-dtr-title">Attendance sessions</h3><p>{summary.completedSessions} completed sessions</p></div><form className="student-date-filters" onSubmit={submitFilters}><label>From<input type="date" value={filters.from} onChange={(event)=>setFilters({...filters,from:event.target.value})}/></label><label>To<input type="date" value={filters.to} onChange={(event)=>setFilters({...filters,to:event.target.value})}/></label><button type="submit" className="student-primary-button" disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button></form></header>
      {!displaySessions.length ? <p className="student-empty">No attendance sessions match this period.</p> : <div className="student-dtr-list">{displaySessions.map((session)=>{
        const active=isActiveServiceSession(session)
        return <article className={active?'student-dtr-record student-dtr-record-active':'student-dtr-record'} key={session.id} id={`service-session-${session.id}`} tabIndex={-1}>
          <header><div><strong>{session.department_name || 'Department not recorded'}</strong><span>Assignment #{session.assignment_id}</span></div><AttendanceIndicator sessions={[session]}/></header>
          <dl className="student-session-facts"><div><dt>Time in</dt><dd>{dateTime(session.time_in)}</dd></div><div><dt>Time out</dt><dd>{active?'Pending staff Time Out':dateTime(session.time_out)}</dd></div><div><dt>Worked</dt><dd>{active ? Array.isArray(liveDtr?.sessions) ? 'See current session above' : 'Current attendance unavailable' : formatMinutes(session.worked_minutes)}</dd></div><div><dt>Credited</dt><dd>{session.credited_minutes == null ? '—' : formatMinutes(session.credited_minutes)}</dd></div>{!active && <div><dt>Attendance outcome</dt><dd>{attendanceOutcomeLabel(session.attendance_outcome)}</dd></div>}</dl>
          <details className="student-session-details"><summary>Details</summary><dl className="student-session-facts"><div><dt>Mode / target</dt><dd>{session.session_type==='FIXED'?formatMinutes(session.selected_duration_minutes):session.session_type==='OPEN_TIME'?'Open Time':'Legacy session'}</dd></div><div><dt>Session status</dt><dd>{formatDisplayLabel(session.completion_reason || session.status)}</dd></div><div><dt>Recorded by</dt><dd>{session.time_out_recorder_name || session.time_in_recorder_name || ((session.time_out_by_user_id || session.time_in_by_user_id) ? `Staff #${session.time_out_by_user_id || session.time_in_by_user_id}` : 'Staff not recorded')} · {formatDisplayLabel(session.time_out_role || session.time_in_role,'Staff')}</dd></div><div className="student-full-width"><dt>Notes / remarks</dt><dd>{session.result_notes || session.notes || '—'}</dd></div></dl></details>
        </article>
      })}</div>}
    </section>
  </section>
}
export default StudentCommunityService
