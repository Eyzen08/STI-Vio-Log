export const buildViolationPayload = (form = {}) => ({
  student_id: Number(form.student_id),
  violation_type_id: Number(form.violation_type_id),
  incident_date: form.incident_date || new Date().toISOString().slice(0, 10),
  description: String(form.description || '').trim(),
  required_service_hours: Number(form.required_service_hours || 0)
})

export const selectedViolationType = (types = [], id) =>
  types.find((type) => Number(type.id) === Number(id)) || null
