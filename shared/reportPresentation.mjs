import { academicYear, academicLevelLabel, academicProgram } from './studentAcademic.mjs'
import { formatDisplayLabel, formatDuration, formatManilaDate, formatManilaDateTime } from './displayFormat.mjs'

export const reportColumnLabel = (key) => key === 'year_level' ? 'Year / Grade level' : key === 'program' ? 'Program / Strand' : formatDisplayLabel(key)

export const statusLabel = (status) => ({
  OPEN: 'Open', COMPLETE: 'Completed', CLEAR: 'Cleared', INVALID_CANCEL: 'Invalid / Cancelled', CREATE: 'Recorded', REOPEN: 'Reopened'
}[status] || formatDisplayLabel(status, 'Unknown'))

export function reportCell(key, value, row) {
  if (key === 'program' && row) return academicProgram(row)
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (key === 'academic_level') return academicLevelLabel({academic_level:value})
  if (key === 'year_level') return academicYear({year_level:value})
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (/(^|_)hours$/.test(key) && Number.isFinite(Number(value))) return `${Number(value) < 0 ? '−' : ''}${formatDuration(Math.abs(Number(value)))}`
  if (/(^|_)minutes$/.test(key) && Number.isFinite(Number(value))) return formatDuration(Number(value) / 60)
  if (/(^|_)date$/.test(key)) return formatManilaDate(value)
  if (/_at$/.test(key)) return formatManilaDateTime(value)
  if (/(^|_)status$/.test(key)) return statusLabel(value)
  if (/(^|_)(role|severity|condition)$/.test(key) || ['standing','attendance_outcome','contact_method','outcome','guardian_relationship'].includes(key)) return formatDisplayLabel(value)
  return String(value)
}

export const presentedReportRows = (rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [reportColumnLabel(key), reportCell(key, value, row)])))

export const REPORT_TITLES = {
  violations: 'Violations Report', 'community-service': 'Community Service Report', dtr: 'DTR / Attendance Report',
  'non-compliance': 'Non-Compliance Report', 'parent-contacts': 'Guardian Contact Report', clearance: 'Clearance Report', 'good-standing': 'Good-Standing Report'
}
export const reportFilename = (type, time = new Date()) => `STI_Vio-Log_${REPORT_TITLES[type].replaceAll(' / ', '_').replaceAll(' ', '_')}_${new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(time)}.xlsx`
const FIELDS = {
  violations: ['student_name','student_number','violation_name','handbook_offense','incident_date','status','incident_details'],
  'community-service': ['student_name','student_number','violation_name','department_name','required_hours','completed_hours','remaining_hours','status','assigned_at','completed_at'],
  dtr: ['student_name','student_number','department_name','assignment_status','required_hours','credited_hours','remaining_hours','total_completed_sessions','total_worked_minutes','total_credited_minutes','manual_adjustment_hours','attendance_outcome','first_attendance_at','latest_attendance_at'],
  'non-compliance': ['student_name','student_number','academic_level','program','year_level','open_violations','pending_hours','last_violation_date'],
  'parent-contacts': ['student_name','student_number','guardian_name','guardian_relationship','contact_method','outcome','contacted_by','department_name','notes','created_at'],
  clearance: ['student_name','student_number','academic_year','semester','status','has_active_violation','has_pending_service','cleared_at','remarks','updated_at'],
  'good-standing': ['student_name','student_number','academic_level','program','year_level','section','standing','historical_violations'],
  corrections: ['student_name','student_number','department_name','previous_completed_hours','new_completed_hours','reason','created_at']
}
const LABELS = {student_name:'Student',violation_name:'Classification',handbook_offense:'Handbook offense',incident_details:'Incident details',department_name:'Department',completed_hours:'Credited time',credited_hours:'Credited time',required_hours:'Required time',remaining_hours:'Remaining time',pending_hours:'Pending service',total_completed_sessions:'Completed sessions',total_worked_minutes:'Worked time',total_credited_minutes:'Attendance credit',manual_adjustment_hours:'Manual adjustment',attendance_outcome:'Latest attendance outcome',first_attendance_at:'First attendance',latest_attendance_at:'Latest attendance',previous_completed_hours:'Previous credited time',new_completed_hours:'New credited time'}
export const reportColumns = (type) => (Object.hasOwn(FIELDS,type) ? FIELDS[type] : []).map(key => ({key,label:LABELS[key] || reportColumnLabel(key),width:['incident_details','handbook_offense','notes','remarks','reason'].includes(key)?60:key==='student_name'||key==='violation_name'?28:22}))
export const reportValues = (type, row = {}) => {
  const description = parseViolationDescription(row.description || '')
  return Object.fromEntries(reportColumns(type).map(({key}) => [key,
    key==='student_name' ? [row.first_name,row.last_name].filter(Boolean).join(' ') || 'Not recorded' :
    key==='handbook_offense' ? description.exact_offense : key==='incident_details' ? description.incident_details :
    key==='program' ? academicProgram(row) : row[key]
  ]))
}

export const parseViolationDescription = (description = '') => {
  const match = /^Handbook offense: ([^\n]*)\nIncident details: ([\s\S]*)$/.exec(description)
  return match ? { exact_offense: match[1], incident_details: match[2], legacy: false }
    : { exact_offense: '', incident_details: description, legacy: true }
}
