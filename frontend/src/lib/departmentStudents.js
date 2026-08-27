const numeric = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const buildDepartmentStudentRoster = (report = {}) => {
  const students = new Map()
  for (const row of Array.isArray(report.data) ? report.data : []) {
    const id = Number(row.student_id)
    if (!Number.isFinite(id)) continue
    const current = students.get(id) || {
      id,
      studentNumber: row.student_number || 'Not provided',
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed student',
      assignments: 0,
      completedSessions: 0,
      creditedMinutes: 0,
      remainingHours: 0,
      hasActiveService: false,
      latestAttendanceAt: null
    }
    current.assignments += 1
    current.completedSessions += numeric(row.total_completed_sessions)
    current.creditedMinutes += numeric(row.total_credited_minutes)
    current.remainingHours += numeric(row.remaining_hours)
    current.hasActiveService ||= ['OPEN', 'IN_PROGRESS'].includes(row.assignment_status) && numeric(row.remaining_hours) > 0
    if (row.latest_attendance_at && (!current.latestAttendanceAt || new Date(row.latest_attendance_at) > new Date(current.latestAttendanceAt))) {
      current.latestAttendanceAt = row.latest_attendance_at
    }
    students.set(id, current)
  }
  return [...students.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export const filterDepartmentStudents = (students, query = '', status = 'ALL') => {
  const term = query.trim().toLocaleLowerCase()
  return students.filter((student) => {
    const matchesQuery = !term || `${student.name} ${student.studentNumber}`.toLocaleLowerCase().includes(term)
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? student.hasActiveService : !student.hasActiveService)
    return matchesQuery && matchesStatus
  })
}
