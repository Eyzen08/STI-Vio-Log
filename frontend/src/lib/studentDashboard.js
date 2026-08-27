export const summarizeStudentDashboard = ({ violations = [], assignments = [], clearanceRecords = [], eligibility = null }) => {
  const activeViolations = violations.filter(({ status }) => status === 'OPEN')
  const activeAssignments = assignments.filter(({ status, remaining_hours: remainingHours }) =>
    ['OPEN', 'IN_PROGRESS'].includes(status) && Number(remainingHours) > 0
  )
  const remainingHours = activeAssignments.reduce(
    (total, assignment) => total + Number(assignment.remaining_hours || 0),
    0
  )
  const latestClearance = clearanceRecords[0] || null
  const hasBlocker = eligibility
    ? eligibility.hasActiveViolation || eligibility.hasPendingService
    : activeViolations.length > 0 || activeAssignments.length > 0

  return {
    standing: hasBlocker ? 'Action required' : 'Good standing',
    activeViolations: activeViolations.length,
    activeAssignments: activeAssignments.length,
    remainingHours,
    clearanceStatus: latestClearance?.status || (hasBlocker ? 'NOT ELIGIBLE' : 'PENDING')
  }
}
