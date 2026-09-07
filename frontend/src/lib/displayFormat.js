const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const MANILA_TIME_ZONE = 'Asia/Manila'

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
