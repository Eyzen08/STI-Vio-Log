export const clearanceLabel = (status) => ({
  NOT_ELIGIBLE: 'Not eligible',
  PENDING: 'Pending approval',
  CLEARED: 'Cleared'
}[status] || 'Not requested')

export const summarizeClearance = ({ eligibility, records = [] }) => {
  const latest = records[0] || null
  const hasActiveViolation = Boolean(eligibility?.hasActiveViolation)
  const hasPendingService = Boolean(eligibility?.hasPendingService)
  const eligible = eligibility?.eligible === true
  const status = latest?.status || (eligible ? 'PENDING' : 'NOT_ELIGIBLE')

  return {
    eligible,
    hasActiveViolation,
    hasPendingService,
    status,
    latest
  }
}

export const clearanceBlockers = (summary) => [
  ...(summary.hasActiveViolation ? ['Resolve all open violations.'] : []),
  ...(summary.hasPendingService ? ['Complete all remaining community-service hours.'] : [])
]
