export * from '../../../shared/adminReports.mjs'
import { buildAdminReportQuery } from '../../../shared/adminReports.mjs'
import { API_URL } from './api.js'
import { reportFilename } from '../../../shared/reportPresentation.mjs'

export async function downloadReportExcel(type, filters, token) {
  const query = buildAdminReportQuery(type, filters)
  const response = await fetch(`${API_URL}/api/reports/${type}.xlsx${query ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || data?.message || 'Unable to export this report. Please try again.')
  }
  const url = URL.createObjectURL(await response.blob())
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+\.xlsx)"/)?.[1] || reportFilename(type)
    anchor.click()
  } finally { URL.revokeObjectURL(url) }
}
