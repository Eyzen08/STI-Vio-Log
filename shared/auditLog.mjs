import { formatDisplayLabel, formatDuration, formatManilaDate } from './displayFormat.mjs'

export const AUDIT_PAGE_SIZE = 25

export const buildAuditQuery = (filters = {}, page = 1) => {
  const query = new URLSearchParams({ page: String(page), limit: String(AUDIT_PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    const clean = String(value || '').trim()
    if (clean) query.set(key, clean)
  }
  return query.toString()
}

export const buildAuditExportQuery = (filters = {}) => {
  const query = new URLSearchParams()
  for (const key of ['action', 'table_name', 'user_id', 'from_date', 'to_date']) {
    const clean = String(filters[key] || '').trim()
    if (clean) query.set(key, clean)
  }
  return query.toString()
}

export const formatAuditAction = (action = '') => formatDisplayLabel(action)

export const auditActorLabel = (entry = {}) =>
  entry.actor_name || entry.actor_username || (entry.user_id ? `User #${entry.user_id}` : 'System')

const RECORD_TYPES = {
  users: 'Account', students: 'Student', violations: 'Violation',
  community_service_sessions: 'Community service session', community_service_assignments: 'Service assignment',
  student_offense_escalations: 'Student offense level', student_clearance: 'Student clearance',
  clearance_certificates: 'Clearance certificate', departments: 'Department',
  parent_contact_logs: 'Guardian contact', officer_department_assignments: 'Officer assignment',
  officer_availability: 'Officer availability', google_identity_links: 'Google account link',
  google_student_registrations: 'Student registration', discipline_officer_signatures: 'Officer signature'
}
export const auditRecordType = (type) => Object.hasOwn(RECORD_TYPES, type) ? RECORD_TYPES[type] : formatDisplayLabel(type, 'System event')
export const auditRecordLabel = (entry = {}) => entry.record_context?.label || `${auditRecordType(entry.table_name)}${entry.record_id != null ? ` #${entry.record_id}` : ''}`
const duration = (minutes) => Number(minutes) === 0 ? '0 minutes' : formatDuration(Number(minutes) / 60)

export const auditSummary = (entry = {}) => {
  const data = entry.details || {}, context = entry.record_context || {}
  if (entry.action === 'TIME_IN') return `Started community service${context.department_name ? ` at ${context.department_name}` : ''}${context.supervisor_name ? `, supervised by ${context.supervisor_name}` : ''}.`
  if (entry.action === 'TIME_OUT_CREDITED' || entry.action === 'SERVICE_RESULT_APPROVE') {
    const action = entry.action === 'SERVICE_RESULT_APPROVE' ? 'Approved service result' : data.attendance_outcome === 'LEFT_EARLY' || data.completion_reason === 'EARLY_TIME_OUT' ? 'Timed out early' : 'Recorded community service time out'
    return `${action}${data.credited_minutes != null ? `; ${duration(data.credited_minutes)} credited` : ''}${data.attendance_outcome && data.attendance_outcome !== 'LEFT_EARLY' ? ` (${formatDisplayLabel(data.attendance_outcome).toLowerCase()})` : ''}.`
  }
  if (data.to_status) return `${data.from_status ? `Changed violation status from ${formatDisplayLabel(data.from_status)} to` : 'Created violation with status'} ${formatDisplayLabel(data.to_status)}.`
  if (['OFFENSE_ESCALATED', 'OFFENSE_DEESCALATED'].includes(entry.action) && data.to) return `Changed offense level${data.from ? ` from ${formatDisplayLabel(data.from)}` : ''} to ${formatDisplayLabel(data.to)}.`
  if (data.changes && Object.keys(data.changes).length) return `Updated ${Object.keys(data.changes).map((key) => formatDisplayLabel(key).toLowerCase()).join(', ')}.`
  if (entry.action === 'SERVICE_RESULT_REJECT') return `Rejected service result${data.reason ? `: ${data.reason}` : '.'}`
  const text = entry.description?.trim()
  if (text && !/^[{[]/.test(text)) return text
  return `${formatAuditAction(entry.action)}${data.reason ? `: ${data.reason}` : '.'}`
}

const DETAIL_LABELS = {
  assignment_id: 'Service assignment', department_id: 'Department', supervising_officer_user_id: 'Supervising officer',
  actual_elapsed_minutes: 'Actual elapsed time', worked_minutes: 'Worked time', credited_minutes: 'Credited time', timer_limit_minutes: 'Timer limit',
  completion_reason: 'Completion reason', attendance_outcome: 'Attendance outcome', supervisor_changed: 'Supervisor changed',
  limit_reached: 'Timer limit reached', from: 'Previous offense level', to: 'New offense level',
  from_status: 'Previous status', to_status: 'New status', policy_scope: 'Policy scope'
}
const detailValue = (key, value, context) => {
  if (value == null) return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (key.endsWith('_minutes')) return formatDuration(Number(value) / 60)
  if (key.endsWith('_hours')) return formatDuration(value)
  if (key === 'incident_date') return formatManilaDate(`${String(value).slice(0, 10)}T00:00:00+08:00`)
  if (key === 'department_id') return context.department_name ? `${context.department_name} (#${value})` : `Department #${value}`
  if (key === 'supervising_officer_user_id') return context.supervisor_name ? `${context.supervisor_name} (#${value})` : `User #${value}`
  if (key === 'assignment_id') return `Service assignment #${value}`
  if (key === 'reason' || key === 'description' || key === 'incident_time') return String(value)
  return typeof value === 'string' ? formatDisplayLabel(value) : String(value)
}
export const auditDetailRows = (entry = {}) => {
  const context = entry.record_context || {}
  const rows = []
  for (const [key, value] of Object.entries(entry.details || {})) {
    if (key === 'actor_role' || value == null) continue
    if (key === 'changes') {
      for (const [field, change] of Object.entries(value)) rows.push({ label: formatDisplayLabel(field), value: `${detailValue(field, change.before, context)} → ${detailValue(field, change.after, context)}` })
    } else rows.push({ label: DETAIL_LABELS[key] || formatDisplayLabel(key), value: detailValue(key, value, context) })
  }
  return rows
}
