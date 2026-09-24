import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { assignmentsForStudent, summarizeServiceAssignments } from '../lib/adminServiceTime.js'
import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import { formatLiveServiceTime, isActiveServiceSession, serviceProgress, serviceSessionTiming } from '../lib/departmentService.js'

export default function StudentServiceTimeDrawer({ student, assignments = [], activeSessions = [], onClose, onRefreshAttendance }) {
  const [now, setNow] = useState(Date.now())
  const studentAssignments = useMemo(() => assignmentsForStudent(assignments, student.id), [assignments, student.id])
  const summary = useMemo(() => summarizeServiceAssignments(studentAssignments), [studentAssignments])
  const activeSession = activeSessions.filter(isActiveServiceSession).find((session) => Number(session.student_id) === Number(student.id))

  useEffect(() => {
    if (!activeSession) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeSession?.session_id])

  useEffect(() => {
    if (!onRefreshAttendance) return undefined
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') onRefreshAttendance() }
    refreshWhenVisible()
    const poller = window.setInterval(refreshWhenVisible, 15000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(poller)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [onRefreshAttendance])

  const timing = activeSession ? serviceSessionTiming(activeSession, now) : null
  return <Modal title="Student Service Time" drawer onClose={onClose}>
    <section className="service-time-drawer">
      <header><span className="page-breadcrumb">Community service overview</span><h3>{student.first_name} {student.last_name}</h3><p>{student.student_number}</p></header>
      {activeSession && <section className="service-time-live" aria-label="Active attendance session"><div><span>Currently timed in</span><time dateTime={`PT${timing.elapsedSeconds}S`}>{formatLiveServiceTime(timing.elapsedSeconds)}</time></div>{timing.limitReached && <p className="timer-limit-notice">Service limit reached — Time Out required</p>}<dl><div><dt>Department</dt><dd>{activeSession.department_name || 'Not assigned'}</dd></div><div><dt>Time in</dt><dd>{formatManilaDateTime(activeSession.time_in)}</dd></div></dl><p>Active time remains uncredited until time-out and review.</p></section>}
      {studentAssignments.length ? <>
        <section className="service-time-summary" aria-label="Overall service progress"><div><span>Required</span><strong>{formatDuration(summary.required)}</strong></div><div><span>Completed</span><strong>{formatDuration(summary.completed)}</strong></div><div><span>Remaining</span><strong>{formatDuration(summary.remaining)}</strong></div></section>
        <div className="service-time-overall"><div><span style={{ width: `${summary.progress}%` }} /></div><p><strong>{summary.progress}%</strong> overall credited progress</p></div>
        <section className="service-time-assignment-list" aria-label="Service assignments"><div className="table-header"><div><h3>Assignments</h3><p>Credited progress for every assignment.</p></div><span>{studentAssignments.length}</span></div>{studentAssignments.map((assignment) => {
          const progress = serviceProgress(assignment)
          return <article key={assignment.id}><header><div><h4>{assignment.department_name || assignment.department_code || 'Department not assigned'}</h4><p>{assignment.violation_name || assignment.exact_offense || `Assignment #${assignment.id}`}</p></div><span className="status-badge">{String(assignment.status || 'OPEN').replaceAll('_', ' ')}</span></header><div className="table-progress"><div><span style={{ width: `${progress}%` }} /></div><small>{formatDuration(assignment.completed_hours)} completed of {formatDuration(assignment.required_hours)} · {formatDuration(assignment.remaining_hours)} remaining</small></div></article>
        })}</section>
      </> : <p className="empty-state">This student has no community service assignment.</p>}
    </section>
  </Modal>
}
