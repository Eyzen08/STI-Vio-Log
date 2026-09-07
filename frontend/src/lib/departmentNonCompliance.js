const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const nonComplianceSummary = (report = {}) => {
  const rows = Array.isArray(report.data) ? report.data : []
  return {
    students: number(report.total_non_compliant_students || rows.length),
    openViolations: rows.reduce((sum, row) => sum + number(row.open_violations), 0),
    pendingHours: rows.reduce((sum, row) => sum + number(row.pending_hours), 0)
  }
}

export const nonComplianceSortQuery = (sortBy) => ['date', 'hours', 'violations'].includes(sortBy) ? `sort_by=${sortBy}` : ''

export const readableIncidentDate = (value) => {
  return formatManilaDate(value)
}
import { formatManilaDate } from './displayFormat.js'
