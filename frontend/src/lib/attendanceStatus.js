import { isActiveServiceSession } from './departmentService.js'

const sessionId = (session) => String(session.id ?? session.session_id)

// Compare successful, unfiltered snapshots. Initial loads never announce old activity.
export const attendanceTransitions = (previous, current) => {
  if (!Array.isArray(previous)) return []
  const previousById = new Map(previous.map((session) => [sessionId(session), session]))
  const currentById = new Map(current.map((session) => [sessionId(session), session]))
  const changes = []
  for (const session of current) {
    const before = previousById.get(sessionId(session))
    if (isActiveServiceSession(session) && !isActiveServiceSession(before)) {
      changes.push({ action: 'TIME IN', assignmentId: session.assignment_id, sessionId: sessionId(session) })
    } else if (!before && session.status === 'COMPLETED' && session.time_out) {
      // A full time-in/time-out can happen between two fallback polls.
      changes.push({ action: 'TIME OUT', assignmentId: session.assignment_id, sessionId: sessionId(session) })
    }
  }
  for (const session of previous.filter(isActiveServiceSession)) {
    if (!isActiveServiceSession(currentById.get(sessionId(session)))) {
      changes.push({ action: 'TIME OUT', assignmentId: session.assignment_id, sessionId: sessionId(session) })
    }
  }
  return changes
}

export const attendanceRoster = (students = [], assignments = [], sessions = [], query = '') => {
  const studentsById = new Map(students.map((student) => [String(student.id), student]))
  const roster = new Map()
  for (const assignment of assignments) {
    const id = String(assignment.student_id)
    if (!roster.has(id)) roster.set(id, {
      ...(studentsById.get(id) || assignment), student_id: assignment.student_id, sessions: []
    })
  }
  for (const session of sessions.filter(isActiveServiceSession)) {
    const id = String(session.student_id)
    if (!roster.has(id)) roster.set(id, { ...session, student_id: session.student_id, sessions: [] })
    roster.get(id).sessions.push(session)
  }
  const term = query.trim().toLowerCase()
  return [...roster.values()].filter((student) => !term || [student.first_name, student.last_name,
    student.student_number, ...student.sessions.map((session) => session.department_name)]
    .filter(Boolean).join(' ').toLowerCase().includes(term))
    .sort((a, b) => Number(Boolean(b.sessions.length)) - Number(Boolean(a.sessions.length)) ||
      `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`))
}
