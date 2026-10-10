import { academicLevel, academicProgram, academicYear } from './studentAcademic.js'
import { serviceProgress } from './serviceProgress.js'

const text = (value) => String(value || '').toLocaleLowerCase()

export const filterAdminStudents = (students = [], query = '') => {
  const needle = text(query).trim()
  if (!needle) return students
  return students.filter((student) => [student.student_number, student.first_name, student.middle_name, student.last_name, [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '), student.program, student.strand, student.academic_level, student.section].some((value) => text(value).includes(needle)))
}

export const summarizeStudentCondition = (studentId, violations = []) => {
  const records = violations.filter((violation) => Number(violation.student_id) === Number(studentId))
  const open = records.filter((violation) => violation.status === 'OPEN')
  const completed = records.filter((violation) => ['COMPLETE', 'CLEAR'].includes(violation.status))
  const requiredHours = open.reduce((sum, violation) => sum + Number(violation.required_service_hours || 0), 0)
  const completedHours = open.reduce((sum, violation) => sum + Number(violation.completed_service_hours || 0), 0)
  return {records,total:records.length,open:open.length,resolved:completed.length,requiredHours,remainingHours:Math.max(requiredHours-completedHours,0),condition:open.length?'Requires action':records.length?'Resolved - monitor':'Good standing'}
}

export const buildStudentDirectory = (students = [], violations = [], assignments = [], clearances = []) => students.map((student) => {
  const condition = summarizeStudentCondition(student.id, violations)
  const service = assignments.filter((item) => Number(item.student_id) === Number(student.id))
  const required = service.reduce((sum, item) => sum + serviceProgress(item.required_hours, item.remaining_hours).required, 0)
  const remaining = service.reduce((sum, item) => sum + serviceProgress(item.required_hours, item.remaining_hours).remaining, 0)
  const inService = service.some((item) => !['COMPLETED', 'CLEARED'].includes(String(item.status).toUpperCase()))
  // Match the existing clearance eligibility rules: open violations or unfinished active service block approval.
  const blocked = condition.open > 0 || service.some((item) => ['OPEN', 'IN_PROGRESS'].includes(item.status) && Number(item.remaining_hours) > 0)
  const latestClearance = clearances.find((item) => Number(item.student_id) === Number(student.id))
  const clearance = blocked ? 'NOT_CLEARED' : latestClearance?.status === 'CLEARED' ? 'CLEARED' : 'ELIGIBLE'
  const level = student.offense_indicator_level
  const severity = !condition.total ? '' : level === 'GRAVE' ? 'Grave' : level === 'MAJOR_LEVEL' ? 'Major-level' : level === 'MINOR_2' ? '2 minors' : level === 'MINOR_1' ? 'Minor'
    : condition.records.some((item) => item.severity === 'GRAVE') ? 'Grave' : condition.records.some((item) => item.severity === 'MAJOR') ? 'Major' : condition.total ? 'Minor' : ''
  const tone = severity === 'Grave' ? 'grave' : ['Major', 'Major-level', '2 minors'].includes(severity) ? 'major' : severity ? 'minor' : 'neutral'
  return { ...student, condition, service: serviceProgress(required, remaining), inService, clearance, severity, tone, programLabel: academicProgram(student), yearLabel: academicYear(student) }
})

export const filterStudentDirectory = (rows, { query = '', program = '', year = '', status = '', tab = 'all', severity = '', attendance = '' } = {}) => filterAdminStudents(rows, query).filter((row) =>
  (!program || row.programLabel === program) && (!year || (year === 'SENIOR_HIGH_SCHOOL' ? academicLevel(row) === year : row.yearLabel === year)) && (!status || row.clearance === status) &&
  (tab !== 'violations' || row.condition.total > 0) && (tab !== 'service' || row.inService) && (tab !== 'cleared' || row.clearance === 'CLEARED') &&
  (!severity || row.tone === severity) && (!attendance || row.timedIn))

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
