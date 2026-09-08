export function serviceProgress(requiredValue, remainingValue) {
  const required = Math.max(0, Number(requiredValue) || 0)
  const remaining = remainingValue == null ? required : Math.min(required, Math.max(0, Number(remainingValue) || 0))
  const completed = required - remaining
  return { required, remaining, completed, percent: required > 0 ? Math.round(completed / required * 100) : 0 }
}

export function nearCompletionAssignments(rows) {
  return rows.filter((row) => Number(row.remaining_hours) > 0 && Number(row.remaining_hours) <= 2)
    .sort((a, b) => Number(a.remaining_hours) - Number(b.remaining_hours))
}
