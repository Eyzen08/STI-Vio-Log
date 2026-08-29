import { studentIdFromSearch, studentOptionLabel } from './violationAdmin.js'

export const communityServiceStudentLabel = studentOptionLabel

export const resolveCommunityServiceStudent = (students = [], search = '') =>
  studentIdFromSearch(students, search)

export const eligibleServiceViolations = (violations = [], assignments = [], studentId) => {
  const assignedViolationIds = new Set(assignments.map((assignment) => Number(assignment.violation_id)))
  return violations.filter((violation) =>
    Number(violation.student_id) === Number(studentId)
    && violation.status === 'OPEN'
    && !assignedViolationIds.has(Number(violation.id))
  )
}

export const communityServiceViolationLabel = (violation = {}) => {
  const name = violation.violation_name || violation.exact_offense || 'Violation'
  const date = violation.incident_date ? ` · ${violation.incident_date}` : ''
  return `#${violation.id} — ${name}${date}`
}

export const buildCommunityServiceAssignmentPayload = (form = {}) => ({
  violation_id: Number(form.violation_id),
  student_id: Number(form.student_id),
  required_hours: Number(form.required_hours || 0),
  department_id: Number(form.department_id),
  department_head_id: Number(form.department_head_id)
})

export const headsForDepartment = (destinations = [], departmentId) =>
  destinations.filter((destination) => Number(destination.department_id) === Number(departmentId))

export const serviceDepartmentOptions = (destinations = []) =>
  [...new Map(destinations.map((destination) => [
    Number(destination.department_id),
    {
      id: Number(destination.department_id),
      code: destination.department_code || '',
      name: destination.department_name || 'Unnamed department'
    }
  ])).values()]
