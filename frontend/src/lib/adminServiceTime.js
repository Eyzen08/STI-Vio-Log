const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export const assignmentsForStudent = (assignments = [], studentId) => assignments.filter(
  (assignment) => Number(assignment.student_id) === Number(studentId)
)

export const summarizeServiceAssignments = (assignments = []) => {
  const totals = assignments.reduce((summary, assignment) => {
    const required = amount(assignment.required_hours)
    const hasCompleted = assignment.completed_hours !== null && assignment.completed_hours !== undefined
    const hasRemaining = assignment.remaining_hours !== null && assignment.remaining_hours !== undefined
    const reportedCompleted = hasCompleted ? amount(assignment.completed_hours) : required - amount(assignment.remaining_hours)
    const completed = Math.min(required, Math.max(0, reportedCompleted))
    return {
      required: summary.required + required,
      completed: summary.completed + completed,
      remaining: summary.remaining + (hasRemaining ? amount(assignment.remaining_hours) : Math.max(0, required - completed))
    }
  }, { required: 0, completed: 0, remaining: 0 })

  return {
    ...totals,
    progress: totals.required > 0 ? Math.min(100, Math.round((totals.completed / totals.required) * 100)) : 0
  }
}
