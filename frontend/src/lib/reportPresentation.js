import { formatDuration, formatManilaDate, formatManilaDateTime } from './displayFormat.js'

export const reportColumnLabel = (key) => key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function reportCell(key, value) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (/(^|_)hours$/.test(key) && Number.isFinite(Number(value))) return formatDuration(value)
  if (/(^|_)minutes$/.test(key) && Number.isFinite(Number(value))) return formatDuration(Number(value) / 60)
  if (/(^|_)date$/.test(key)) return formatManilaDate(value)
  if (/_at$/.test(key)) return formatManilaDateTime(value)
  if (/(^|_)(status|role|severity|condition)$/.test(key)) return String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
  return String(value)
}

export const presentedReportRows = (rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [reportColumnLabel(key), reportCell(key, value)])))
