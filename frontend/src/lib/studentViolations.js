const asHours = (value) => {
  const hours = Number(value)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

export const formatHours = (value) => {
  const hours = asHours(value)
  return hours.toFixed(hours % 1 === 0 ? 0 : 2)
}

export const normalizeViolation = (violation) => ({
  ...violation,
  violation_name: violation.violation_name || `Violation #${violation.id}`,
  severity: violation.severity || 'MINOR',
  required_service_hours: asHours(violation.required_service_hours),
  completed_service_hours: asHours(violation.completed_service_hours),
  remaining_service_hours: asHours(violation.remaining_service_hours),
  history: Array.isArray(violation.history) ? violation.history : []
})

export const statusLabel = (status) => ({
  OPEN: 'Open',
  COMPLETE: 'Completed',
  CLEAR: 'Cleared',
  INVALID_CANCEL: 'Invalid / cancelled',
  CREATE: 'Recorded',
  REOPEN: 'Reopened'
}[status] || String(status || 'Unknown').replaceAll('_', ' '))
