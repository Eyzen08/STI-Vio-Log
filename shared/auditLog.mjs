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
  community_service_sessions: 'Community Service Session', community_service_assignments: 'Service Assignment',
  student_offense_escalations: 'Student Offense Level', student_clearance: 'Student Clearance',
  clearance_certificates: 'Clearance Certificate', departments: 'Department',
  parent_contact_logs: 'Guardian Contact', officer_department_assignments: 'Officer Assignment',
  officer_availability: 'Officer Availability', google_identity_links: 'Google Account Link',
  google_student_registrations: 'Student Registration', discipline_officer_signatures: 'Officer Signature'
}
export const auditRecordType = (type) => Object.hasOwn(RECORD_TYPES, type) ? RECORD_TYPES[type] : formatDisplayLabel(type, 'System Event')
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
  if (entry.action === 'SERVICE_DAY_INVALIDATE') return `Invalidated service day ${data.service_date}; ${duration(data.removed_credit_minutes)} credit removed${data.reason ? `: ${data.reason}` : '.'}`
  const text = entry.description?.trim()
  if (text && !/^[{[]/.test(text)) return text
  return `${formatAuditAction(entry.action)}${data.reason ? `: ${data.reason}` : '.'}`
}

const DETAIL_LABELS = {
  assignment_id: 'Service Assignment', department_id: 'Department', supervising_officer_user_id: 'Supervising Officer',
  actual_elapsed_minutes: 'Actual Elapsed Time', worked_minutes: 'Worked Time', credited_minutes: 'Credited Time', timer_limit_minutes: 'Timer Limit',
  completion_reason: 'Completion Reason', attendance_outcome: 'Attendance Outcome', supervisor_changed: 'Supervisor Changed',
  limit_reached: 'Timer Limit Reached', from: 'Previous Offense Level', to: 'New Offense Level',
  from_status: 'Previous Status', to_status: 'New Status', policy_scope: 'Policy Scope'
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
