const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const formatMinutes = (value) => {
  const minutes = Math.max(0, Math.round(number(value)))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder}m`
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export const summarizeStudentService = (dtr = {}) => {
  const assignments = Array.isArray(dtr.assignments) ? dtr.assignments : []
  const sessions = Array.isArray(dtr.sessions) ? dtr.sessions : []
  return {
    requiredMinutes: assignments.reduce((sum, item) => sum + number(item.required_minutes), 0),
    creditedMinutes: assignments.reduce((sum, item) => sum + number(item.credited_minutes), 0),
    remainingMinutes: assignments.reduce((sum, item) => sum + number(item.remaining_minutes), 0),
    completedSessions: sessions.filter((item) => item.status === 'COMPLETED').length,
    activeSessions: sessions.filter((item) => item.status === 'ACTIVE').length
  }
}

export const validateDateRange = ({ from, to }) => {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/
  const validDate = (value) => {
    if (!isoDate.test(value)) return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (from && !validDate(from)) return 'From date must use YYYY-MM-DD.'
  if (to && !validDate(to)) return 'To date must use YYYY-MM-DD.'
  if (from && to && from > to) return 'From date must be on or before To date.'
  return ''
}
