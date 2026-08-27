export const normalizeQrValue = (value) => typeof value === 'string' ? value.trim() : ''

export const isVerifiedQr = (enteredValue, verifiedValue) => {
  const entered = normalizeQrValue(enteredValue)
  const verified = normalizeQrValue(verifiedValue)
  return Boolean(entered && verified && entered === verified)
}

export const assignmentProgress = (assignment) => {
  const required = Math.max(0, Number(assignment?.required_hours) || 0)
  const completed = Math.max(0, Number(assignment?.completed_hours) || 0)
  const remaining = Math.max(0, Number(assignment?.remaining_hours) || 0)
  return { required, completed, remaining }
}
