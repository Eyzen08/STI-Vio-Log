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

const sanctions = {
  HANDBOOK_MINOR: ['Verbal warning', 'Written reprimand', 'Written reprimand and corrective reinforcement (3-7 school days)', 'More than three minor offenses: review as Major Offense - Category A'],
  HANDBOOK_MAJOR_A: ['Written reprimand and corrective reinforcement (3-7 school days)', 'Suspension (3-7 school days)', 'Non-readmission'],
  HANDBOOK_MAJOR_B: ['Suspension (3-7 school days)', 'Non-readmission'],
  HANDBOOK_MAJOR_C: ['Suspension (7-10 school days)', 'Non-readmission'],
  HANDBOOK_MAJOR_D: ['Exclusion or expulsion, subject to required school and CHED procedures']
}

export const handbookSanctionGuidance = (categoryCounts = []) => categoryCounts.map((category) => {
  const sequence = sanctions[category.code] || []
  const count = Number(category.count || 0)
  const index = Math.min(Math.max(count - 1, 0), Math.max(sequence.length - 1, 0))
  return {...category,count,guidance:sequence[index] || 'Discipline Committee review required'}
})
