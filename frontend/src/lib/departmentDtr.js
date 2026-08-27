const numberOrZero = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const buildDepartmentDtrQuery = (filters = {}) => {
  const query = new URLSearchParams()
  for (const key of ['from', 'to', 'student_id', 'assignment_id']) {
    const value = String(filters[key] || '').trim()
    if (value) query.set(key, value)
  }
  return query.toString()
}

export const departmentDtrSummary = (report = {}) => ({
  records: numberOrZero(report.total_records),
  completedSessions: numberOrZero(report.totals?.completed_sessions),
  workedMinutes: numberOrZero(report.totals?.worked_minutes),
  creditedMinutes: numberOrZero(report.totals?.credited_minutes)
})

export const displayDepartmentDtrDate = (value) => {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}
