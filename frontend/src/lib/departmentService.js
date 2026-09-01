const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const summarizeDepartmentService = (assignments = []) => ({
  total: assignments.length,
  active: assignments.filter((item) => ['OPEN', 'IN_PROGRESS'].includes(item.status) && amount(item.remaining_hours) > 0).length,
  completed: assignments.filter((item) => item.status === 'COMPLETED').length,
  remainingHours: assignments.reduce((sum, item) => sum + amount(item.remaining_hours), 0)
})

export const filterDepartmentService = (assignments, query = '', status = 'ALL') => {
  const term = query.trim().toLowerCase()
  return assignments.filter((item) => {
    const text = `${item.first_name || ''} ${item.last_name || ''} ${item.student_number || ''}`.toLowerCase()
    return (!term || text.includes(term)) && (status === 'ALL' || (status === 'ACTIVE' ? ['OPEN', 'IN_PROGRESS'].includes(item.status) : item.status === status))
  })
}

export const serviceProgress = (assignment) => {
  const required = amount(assignment.required_hours)
  const completed = amount(assignment.completed_hours)
  return required > 0 ? Math.min(100, Math.max(0, Math.round((completed / required) * 100))) : 100
}

export const liveServiceSeconds = (timeIn, now = Date.now()) => {
  const startedAt = new Date(timeIn).getTime()
  const current = Number(now)
  if (!Number.isFinite(startedAt) || !Number.isFinite(current)) return 0
  return Math.max(0, Math.floor((current - startedAt) / 1000))
}

export const formatLiveServiceTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':')
}
