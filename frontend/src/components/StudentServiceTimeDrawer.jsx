import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { assignmentsForStudent, summarizeServiceAssignments } from '../lib/adminServiceTime.js'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import { isActiveServiceSession, serviceProgress } from '../lib/departmentService.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import ServiceHourCorrections from './ServiceHourCorrections.jsx'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import '../styles/student-action-drawers.css'

export function StudentServiceTimeContent({ student, assignments = [], activeSessions = [], attendanceReady = true, attendanceError }) {
  const [now, setNow] = useState(Date.now())
  const studentAssignments = useMemo(() => assignmentsForStudent(assignments, student.id), [assignments, student.id])
  const summary = useMemo(() => summarizeServiceAssignments(studentAssignments), [studentAssignments])
  const studentSessions = activeSessions.filter(isActiveServiceSession).filter((session) => Number(session.student_id) === Number(student.id))
  const activeSession = studentSessions[0]

  useEffect(() => {
    if (!activeSession) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeSession?.session_id])

  return <section className="service-time-drawer student-action-content">
      <header className="service-student-card"><Avatar identity={student} avatar={student.avatar?.photo_url ? { ...student.avatar, source: 'PHOTO' } : null} className="service-student-avatar"/><div><h3>{student.first_name} {student.last_name}</h3><p>{student.student_number}</p><AttendanceIndicator sessions={studentSessions} ready={attendanceReady} details/></div></header>
      {attendanceError && <p className="attendance-update-error">{attendanceError}</p>}
      <section className="service-time-summary" aria-label="Overall service progress">{[['Required', summary.required, 'clock', 'blue'], ['Completed', summary.completed, 'check', 'green'], ['Remaining', summary.remaining, 'hourglass', 'orange']].map(([label, value, icon, tone]) => <div key={label} className={`service-metric service-metric-${tone}`}><i><PortalIcon name={icon} size={22}/></i><div><span>{label}</span><strong>{formatDuration(value)}</strong></div></div>)}</section>
      <div className="service-time-overall"><progress value={summary.progress} max="100" aria-label="Overall credited service progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary.progress}/><p><strong>{summary.progress}%</strong> overall credited progress</p></div>
      {studentSessions.map((session) => <section key={session.session_id} className="service-time-live" aria-label="Active attendance session"><div><span>Remaining session time</span><ServiceCountdown session={session} now={now}/></div><dl><div><dt>Department</dt><dd>{session.department_name || 'Not assigned'}</dd></div><div><dt>Time in</dt><dd>{formatManilaDateTime(session.time_in)}</dd></div></dl><p>Active time remains uncredited until time-out and review.</p></section>)}
      <section className="service-time-assignment-list" aria-label="Service assignments"><header className="service-section-heading"><div><h3>Assignments</h3><p>Credited progress for every assignment.</p></div><span>{studentAssignments.length} assignment{studentAssignments.length === 1 ? '' : 's'}</span></header>{studentAssignments.map((assignment) => {
          const credited = summarizeServiceAssignments([assignment])
          const progress = assignment.completed_hours == null ? credited.progress : serviceProgress(assignment)
          const supervisor = [assignment.department_head_first_name, assignment.department_head_last_name].filter(Boolean).join(' ')
          return <article key={assignment.id}><header><div><h4>{supervisor || assignment.department_name || assignment.department_code || 'Department not assigned'}</h4><p>Assignment #{assignment.id}{supervisor && assignment.department_name ? ` • ${assignment.department_name}` : ''}</p>{(assignment.violation_name || assignment.exact_offense) && <p>{assignment.violation_name || assignment.exact_offense}</p>}</div><span className={`service-assignment-status service-status-${String(assignment.status || 'OPEN').toLowerCase()}`}>{formatDisplayLabel(assignment.status || 'OPEN')}</span></header><div className="table-progress"><progress value={progress} max="100" aria-label={`Credited progress for assignment #${assignment.id}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}/><small>{formatDuration(credited.completed)} completed of {formatDuration(credited.required)} · {formatDuration(credited.remaining)} remaining</small></div></article>
        })}{!studentAssignments.length && <p className="empty-state">No community service assignments yet.</p>}{studentAssignments.length > 0 && summary.required === 0 && <p className="empty-state">No community service is currently required.</p>}</section>
      <ServiceHourCorrections compact corrections={studentAssignments.flatMap((assignment) => assignment.hour_corrections || [])}/>
    </section>
}

export default function StudentServiceTimeDrawer({ onClose, ...props }) {
  return <Modal title="Student Service Time" className="student-action-modal service-time-modal" drawer onClose={onClose}><StudentServiceTimeContent {...props}/></Modal>
}
