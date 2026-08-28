const text = (value) => String(value || '').toLocaleLowerCase()

export const filterAdminStudents = (students = [], query = '') => {
  const needle = text(query).trim()
  if (!needle) return students
  return students.filter((student) => [student.student_number, student.first_name, student.middle_name, student.last_name, student.program, student.section].some((value) => text(value).includes(needle)))
}

export const summarizeStudentCondition = (studentId, violations = []) => {
  const records = violations.filter((violation) => Number(violation.student_id) === Number(studentId))
  const open = records.filter((violation) => violation.status === 'OPEN')
  const completed = records.filter((violation) => ['COMPLETE', 'CLEAR'].includes(violation.status))
  const requiredHours = open.reduce((sum, violation) => sum + Number(violation.required_service_hours || 0), 0)
  const completedHours = open.reduce((sum, violation) => sum + Number(violation.completed_service_hours || 0), 0)
  return {records,total:records.length,open:open.length,resolved:completed.length,requiredHours,remainingHours:Math.max(requiredHours-completedHours,0),condition:open.length?'Requires action':records.length?'Resolved - monitor':'Good standing'}
}
