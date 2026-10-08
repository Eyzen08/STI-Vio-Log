export * from '../../../shared/auditLog.mjs'
import { buildAuditExportQuery } from '../../../shared/auditLog.mjs'
import { API_URL } from './api.js'

export async function downloadAuditExcel(filters, token) {
  const query = buildAuditExportQuery(filters)
  const response = await fetch(`${API_URL}/api/audit-logs/export.xlsx${query ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || data?.message || 'Unable to generate Excel. Please try again.')
  }
  const url = URL.createObjectURL(await response.blob())
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+\.xlsx)"/)?.[1] || 'STI_Vio-Log_Audit_Log.xlsx'
    anchor.click()
  } finally { URL.revokeObjectURL(url) }
}
