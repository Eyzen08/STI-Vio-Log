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

export const departmentDtrSummary = (report = {}) => {
  const safeReport = report && typeof report === 'object' ? report : {}
  const totals = safeReport.totals && typeof safeReport.totals === 'object' ? safeReport.totals : {}
  return {
    records: numberOrZero(safeReport.total_records),
    completedSessions: numberOrZero(totals.completed_sessions),
    workedMinutes: numberOrZero(totals.worked_minutes),
    creditedMinutes: numberOrZero(totals.credited_minutes)
  }
}

export const displayDepartmentDtrDate = (value) => {
  return formatManilaDateTime(value)
}
import { formatManilaDateTime } from './displayFormat.js'
