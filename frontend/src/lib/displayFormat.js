const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

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

