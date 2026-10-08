const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const MANILA_TIME_ZONE = 'Asia/Manila'

const DISPLAY_LABELS = {
  DISCIPLINE_ADMIN: 'Discipline Administrator',
  DISCIPLINE_OFFICE: 'Discipline Office',
  DEPARTMENT_HEAD: 'Department Head',
  IN_PROGRESS: 'In Progress',
  NOT_ELIGIBLE: 'Not Eligible',
  TIMED_IN: 'Timed In',
  TIMED_OUT: 'Timed Out',
  NEEDS_FOLLOW_UP: 'Needs Follow-Up',
  LEFT_EARLY: 'Left Early',
  TODAY_SERVICE_COMPLETED: "Today's Service Completed",
  TODAYS_SERVICE_COMPLETED: "Today's Service Completed",
  SERVICE_COMPLETED: 'Service Completed',
  INVALID_CANCEL: 'Invalid / Cancelled',
  AWAITING_CLEARANCE: 'Awaiting Clearance',
  NEEDS_SERVICE: 'Needs Service Hours',
  NO_SERVICE_REQUIRED: 'No Service Assignment',
  ACCOUNT_RECOVERY: 'Account Recovery',
  ACCOUNT_LOCK: 'Account Lock',
  E_SIGNATURE_MANAGEMENT: 'E-Signature Management',
  BSCPE: 'BSCpE',
}

const PRESERVED_TERMS = new Set([
  'STI', 'QR', 'OTP', 'CSV', 'DTR', 'ID', 'API', 'URL', 'UTC', 'UI', 'UX', 'DO', 'IT', 'ICT',
  'BSIT', 'BSCS', 'BSBA', 'BSAIS', 'BSHM', 'BSTM', 'ABM', 'HUMSS', 'STEM',
])

export const formatDisplayLabel = (value, fallback = '—') => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback
  const raw = String(value).trim()
  const key = raw.toUpperCase().replace(/[\s-]+/g, '_')
  if (DISPLAY_LABELS[key]) return DISPLAY_LABELS[key]
  return raw
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`)
    .split(' ')
    .map((word) => PRESERVED_TERMS.has(word.toUpperCase()) ? word.toUpperCase() : word)
    .join(' ')
}

const validDate = (value) => {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatManilaDate = (value, fallback = 'Not recorded') => {
  const date = validDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

export const formatManilaDateTime = (value, fallback = 'Not recorded') => {
  const date = validDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export const formatManilaTime = (value, fallback = '') => {
  const date = validDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export const hoursToMinutes = (hours) => Math.max(0, Math.round(number(hours) * 60))

export const formatDuration = (hours) => {
  const total = hoursToMinutes(hours)
  const wholeHours = Math.floor(total / 60)
  const minutes = total % 60
  if (wholeHours && minutes) return `${wholeHours} hr ${minutes} min`
  if (wholeHours) return `${wholeHours} hr`
  return `${minutes} min`
}

export const formatIncidentDateTime = (incidentDate, incidentTime) => {
  if (!incidentDate) return 'Not recorded'
  if (!incidentTime) {
    const [year, month, day] = String(incidentDate).slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return 'Not recorded'
    return `${new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day))} · Time not recorded`
  }
  const date = new Date(`${String(incidentDate).slice(0, 10)}T${String(incidentTime).slice(0, 8)}+08:00`)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  }).format(date).replace(' at ', ' at ')
}
