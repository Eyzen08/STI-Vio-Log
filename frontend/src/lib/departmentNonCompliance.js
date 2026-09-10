const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const nonComplianceSummary = (report = {}) => {
  const safeReport = report && typeof report === 'object' ? report : {}
  const rows = Array.isArray(safeReport.data) ? safeReport.data.filter((row) => row && typeof row === 'object') : []
  return {
    students: number(safeReport.total_non_compliant_students || rows.length),
    openViolations: rows.reduce((sum, row) => sum + number(row.open_violations), 0),
    pendingHours: rows.reduce((sum, row) => sum + number(row.pending_hours), 0)
  }
}

export const nonComplianceSortQuery = (sortBy) => ['date', 'hours', 'violations'].includes(sortBy) ? `sort_by=${sortBy}` : ''

export const readableIncidentDate = (value) => {
  return formatManilaDate(value)
}
import { formatManilaDate } from './displayFormat.js'
