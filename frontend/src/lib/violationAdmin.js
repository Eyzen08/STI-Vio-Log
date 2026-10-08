import { parseViolationDescription } from '../../../shared/reportPresentation.mjs'
export { parseViolationDescription }
import handbookOffenses from '../../../shared/handbookOffenses.json' with { type: 'json' }

export const HANDBOOK_OFFENSES = handbookOffenses

export const offensesForType = (type) => {
  const offenses = type ? HANDBOOK_OFFENSES[type.violation_code] : null
  return offenses ? [...offenses, 'Other offense for Discipline Committee review'] : []
}

export const buildViolationDescription = (form = {}) =>
  `Handbook offense: ${String(form.exact_offense || '').trim()}\nIncident details: ${String(form.incident_details || '').trim()}`

export const buildViolationPayload = (form = {}) => ({
  student_id: Number(form.student_id),
  violation_type_id: Number(form.violation_type_id),
  incident_date: form.incident_date || new Date().toISOString().slice(0, 10),
  ...(form.incident_time ? { incident_time: form.incident_time } : {}),
  description: buildViolationDescription(form)
})

export const selectedViolationType = (types = [], id) =>
  types.find((type) => Number(type.id) === Number(id)) || null

export const studentOptionLabel = (student = {}) =>
  `${student.student_number || ''} - ${student.first_name || ''} ${student.last_name || ''}`.trim()

export const studentIdFromSearch = (students = [], search = '') => {
  const normalized = String(search).trim().toLocaleLowerCase()
  const match = students.find((student) => studentOptionLabel(student).toLocaleLowerCase() === normalized)
  return match ? Number(match.id) : ''
}

export const violationEditForm = (violation = {}) => ({
  ...parseViolationDescription(violation.description || ''),
  violation_type_id: String(violation.violation_type_id || ''),
  incident_date: String(violation.incident_date || '').slice(0, 10),
  incident_time: String(violation.incident_time || '').slice(0, 5),
  required_service_hours: String(violation.required_service_hours ?? 0),
  completed_service_hours: String(violation.completed_service_hours ?? 0),
  department_id: '', department_head_id: '', reason: ''
})

export const buildViolationUpdatePayload = (form = {}, original = {}, hasAssignment = true) => ({
  violation_type_id: Number(form.violation_type_id),
  incident_date: form.incident_date,
  incident_time: form.incident_time || null,
  description: form.legacy && !form.exact_offense ? String(form.incident_details || '').trim() : buildViolationDescription(form),
  ...(Number(form.required_service_hours) !== Number(original.required_service_hours) ? { required_service_hours: Number(form.required_service_hours) } : {}),
  ...(Number(form.completed_service_hours) !== Number(original.completed_service_hours) ? { completed_service_hours: Number(form.completed_service_hours) } : {}),
  ...(!hasAssignment && Number(form.required_service_hours) > 0 ? {
    department_id: Number(form.department_id), department_head_id: Number(form.department_head_id)
  } : {}),
  reason: String(form.reason || '').trim()
})

export const validateViolationEditForm = (form, original, types, hasAssignment) => {
  const errors = {}
  const type = selectedViolationType(types, form.violation_type_id)
  const changedType = Number(form.violation_type_id) !== Number(original.violation_type_id)
  const originalOffense = parseViolationDescription(original.description || '').exact_offense
  if (!type && changedType) errors.violation_type_id = 'Select an active classification.'
  if (changedType && !offensesForType(type).includes(form.exact_offense)) errors.exact_offense = 'Select an offense for the new classification.'
  else if (!form.legacy && !form.exact_offense) errors.exact_offense = 'Select an offense.'
  else if (form.exact_offense && form.exact_offense !== originalOffense && !offensesForType(type).includes(form.exact_offense)) errors.exact_offense = 'Select a valid offense.'
  if (!String(form.incident_details || '').trim()) errors.incident_details = 'Enter incident details.'
  if (!form.incident_date) errors.incident_date = 'Enter the incident date.'
  for (const field of ['required_service_hours', 'completed_service_hours']) {
    const value = Number(form[field])
    if (String(form[field]).trim() === '' || !Number.isFinite(value) || value < 0 || value > 9999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) errors[field] = 'Enter hours from 0 to 9999.99, with up to two decimal places.'
  }
  if (Number(form.completed_service_hours) > Number(form.required_service_hours)) errors.completed_service_hours = 'Completed hours cannot exceed required hours.'
  if (!hasAssignment && Number(form.required_service_hours) > 0) {
    if (!form.department_id) errors.department_id = 'Select a department.'
    if (!form.department_head_id) errors.department_head_id = 'Select an active Department Head.'
  }
  if (!String(form.reason || '').trim() || form.reason.length > 1000) errors.reason = 'Enter a reason of 1 to 1000 characters.'
  return errors
}
