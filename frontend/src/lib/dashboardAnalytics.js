const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
})
const iso = (date) => date.toISOString().slice(0, 10)
const utcDate = (key) => new Date(`${key}T00:00:00Z`)
const addDays = (key, days) => iso(new Date(utcDate(key).getTime() + days * 86400000))
const daysBetween = (from, to) => Math.round((utcDate(to) - utcDate(from)) / 86400000)
const monthStart = (key) => `${key.slice(0, 7)}-01`
const previousMonthStart = (key) => iso(new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 2, 1)))
const monthEnd = (key) => addDays(iso(new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1))), -1)
const validDateKey = (key) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const value = utcDate(key)
  return Number.isFinite(value.getTime()) && iso(value) === key
}

export const manilaDateKey = (value = new Date()) => {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  const parts = dateFormat.formatToParts(parsed)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export const periodRange = (period, today, customFrom = '', customTo = '') => {
  if (!validDateKey(today)) return null
  if (period === 'THIS_MONTH') {
    const previousFrom = previousMonthStart(today)
    const day = Math.min(Number(today.slice(8, 10)), Number(monthEnd(previousFrom).slice(8, 10)))
    return { from: monthStart(today), to: today, previousFrom, previousTo: `${previousFrom.slice(0, 8)}${String(day).padStart(2, '0')}` }
  }
  if (period === 'LAST_MONTH') {
    const from = previousMonthStart(today)
    const previousFrom = previousMonthStart(from)
    return { from, to: monthEnd(from), previousFrom, previousTo: monthEnd(previousFrom) }
  }
  if (period === 'THIS_YEAR') {
    const previousFrom = `${Number(today.slice(0, 4)) - 1}-01-01`
    const priorMonth = `${Number(today.slice(0, 4)) - 1}${today.slice(4, 7)}-01`
    const day = Math.min(Number(today.slice(8, 10)), Number(monthEnd(priorMonth).slice(8, 10)))
    return { from: `${today.slice(0, 4)}-01-01`, to: today, previousFrom, previousTo: `${priorMonth.slice(0, 8)}${String(day).padStart(2, '0')}` }
  }
  if (period === 'CUSTOM' && validDateKey(customFrom) && validDateKey(customTo) && customFrom <= customTo) {
    const length = daysBetween(customFrom, customTo) + 1
    return { from: customFrom, to: customTo, previousFrom: addDays(customFrom, -length), previousTo: addDays(customFrom, -1) }
  }
  return null
}

const incidentDateKey = (value) => typeof value === 'string' ? value.slice(0, 10) : value ? iso(value) : ''
const inRange = (key, from, to) => key >= from && key <= to
const studentProgram = (student) => String(student?.program || student?.strand || '').trim() || 'Not recorded'
const classifications = [
  ['MINOR_1', 'First offense'],
  ['MINOR_2', 'Repeat minor'],
  ['MAJOR_LEVEL', 'Major level'],
  ['GRAVE', 'Grave']
]

export const analyticsForRange = ({ students = [], violations = [], assignments = [], range, program = 'ALL' }) => {
  const programsByStudent = new Map(students.map((student) => [Number(student.id), studentProgram(student)]))
  const groupOf = (record) => programsByStudent.get(Number(record.student_id)) || 'Not recorded'
  const matchesProgram = (record) => program === 'ALL' || groupOf(record) === program
  const scopedViolations = violations.filter(matchesProgram)
  const current = scopedViolations.filter((record) => inRange(incidentDateKey(record.incident_date), range.from, range.to))
  const previousViolationCount = scopedViolations.filter((record) => inRange(incidentDateKey(record.incident_date), range.previousFrom, range.previousTo)).length
  const scopedAssignments = assignments.filter((record) => matchesProgram(record) && record.assigned_at && inRange(manilaDateKey(record.assigned_at), range.from, range.to))
  const completed = scopedAssignments.filter((record) => record.status === 'COMPLETED').length
  const active = scopedAssignments.filter((record) => ['OPEN', 'IN_PROGRESS'].includes(record.status)).length
  const total = completed + active
  const programCounts = new Map()
  for (const record of current) programCounts.set(groupOf(record), (programCounts.get(groupOf(record)) || 0) + 1)

  const dayCount = daysBetween(range.from, range.to) + 1
  const span = Math.ceil(dayCount / 6)
  const trend = []
  for (let index = 0; index < dayCount; index += span) {
    const from = addDays(range.from, index)
    const to = addDays(range.from, Math.min(index + span - 1, dayCount - 1))
    trend.push({ from, to, count: current.filter((record) => inRange(incidentDateKey(record.incident_date), from, to)).length })
  }

  return {
    violationCount: current.length,
    previousViolationCount,
    trend,
    classifications: classifications.map(([level, label]) => ({ level, label, count: current.filter((record) => record.offense_indicator_level === level).length })),
    programs: [...programCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    service: { completed, active, total, completionPercent: total ? Math.round(completed / total * 100) : 0 }
  }
}

export const availablePrograms = (students = []) => [...new Set(students.map(studentProgram))].sort((a, b) => a.localeCompare(b))
