import { academicYear, academicLevelLabel, academicProgram } from './studentAcademic.js'
import { formatDisplayLabel, formatDuration, formatManilaDate, formatManilaDateTime } from './displayFormat.js'

export const reportColumnLabel = (key) => key === 'year_level' ? 'Year / Grade level' : key === 'program' ? 'Program / Strand' : formatDisplayLabel(key)

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
  if (/(^|_)(status|role|severity|condition)$/.test(key)) return formatDisplayLabel(value)
  return String(value)
}

export const presentedReportRows = (rows) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [reportColumnLabel(key), reportCell(key, value, row)])))
