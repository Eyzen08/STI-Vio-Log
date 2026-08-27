const asNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const summarizeDepartmentDtr = (report = {}) => {
  const rows = Array.isArray(report.data) ? report.data : []
  const totals = report.totals || {}
  const students = new Set(rows.map((row) => Number(row.student_id)).filter(Number.isFinite))
  const activeAssignments = rows.filter((row) =>
    ['OPEN', 'IN_PROGRESS'].includes(row.assignment_status) && asNumber(row.remaining_hours) > 0
  ).length

  return {
    studentsServed: students.size,
    activeAssignments,
    completedSessions: asNumber(totals.completed_sessions),
    workedMinutes: asNumber(totals.worked_minutes),
    creditedMinutes: asNumber(totals.credited_minutes)
  }
}

export const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, Math.round(asNumber(minutes)))
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  if (!hours) return `${remainder}m`
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}
