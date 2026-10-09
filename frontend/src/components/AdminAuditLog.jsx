import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { auditActorLabel, auditDetailRows, auditRecordLabel, auditRecordType, auditSummary, buildAuditQuery, downloadAuditExcel, formatAuditAction } from '../lib/auditLog.js'
import { formatDisplayLabel, formatManilaDate, formatManilaTime } from '../lib/displayFormat.js'
import { useActionLock } from '../lib/asyncAction.js'
import AsyncActionButton from './AsyncActionButton.jsx'

const initialFilters = { action: '', table_name: '', from_date: '', to_date: '' }

function AuditRow({ entry }) {
  const context = entry.record_context || {}
  const details = auditDetailRows(entry)
  return <tr>
    <td data-label="Date"><time dateTime={entry.created_at}>{formatManilaDate(entry.created_at)}<small>{formatManilaTime(entry.created_at)}</small></time></td>
    <td data-label="Actor"><strong>{auditActorLabel(entry)}</strong>{entry.actor_name && entry.actor_username && <small>{entry.actor_username}</small>}<small>{formatDisplayLabel(entry.actor_role, entry.user_id ? 'Role not recorded' : 'System')}</small></td>
    <td data-label="Action"><span className="status-badge">{formatAuditAction(entry.action)}</span>{entry.details?.result && <small>{formatDisplayLabel(entry.details.result)}</small>}</td>
    <td data-label="Record"><strong>{auditRecordLabel(entry)}</strong>{context.subject_name && <span>{context.subject_name}</span>}{context.subject_identifier && <small>{context.subject_identifier}</small>}{context.department_name && <small>{context.department_name}</small>}{context.violation_label && <small>{context.violation_label}</small>}{context.certificate_number && <small>{context.certificate_number}</small>}</td>
    <td data-label="Description"><p className="audit-event-summary">{auditSummary(entry)}</p>{details.length > 0 && <details className="audit-event-details"><summary>View details<span className="sr-only"> for event #{entry.id}</span></summary><dl>{details.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}</td>
  </tr>
}

function AdminAuditLog({ token }) {
  const [filters, setFilters] = useState(initialFilters)
  const [applied, setApplied] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState([])
  const [options, setOptions] = useState({ actions: [], record_types: [] })
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const runAction = useActionLock()
  const load = useCallback(async (signal) => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API_URL}/api/audit-logs?${buildAuditQuery(applied, page)}`, { signal, headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to load audit activity.')
      if (signal?.aborted) return
      setEntries(data.audit_logs || []); setPagination(data.pagination || { page, limit: 25, total: 0 })
      setOptions(data.filter_options || { actions: [], record_types: [] })
    } catch (loadError) { if (!signal?.aborted) { setEntries([]); setError(loadError.message) } } finally { if (!signal?.aborted) setLoading(false) }
  }, [applied, page, token])
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])
  const generateExcel = () => runAction('audit-export', async () => {
    if (loading || error || pagination.total === 0) return
    setExporting(true); setExportError(''); setExportStatus('')
    try {
      await downloadAuditExcel(applied, token)
      setExportStatus('Excel generated. Your download has started.')
    } catch (downloadError) { setExportError(downloadError.message) } finally { setExporting(false) }
  })
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.limit))
  const activeFilters = [applied.action && formatAuditAction(applied.action), applied.table_name && auditRecordType(applied.table_name), applied.from_date && `From ${applied.from_date}`, applied.to_date && `Through ${applied.to_date}`].filter(Boolean)
  return <section className="audit-workspace">
    <header className="management-page-header portal-page-header"><div><span className="page-breadcrumb">Home / Audit Log</span><h2>Audit Log</h2><p>See who changed accounts, discipline records, attendance, and clearance.</p></div><span className="readonly-badge">Immutable history</span></header>
    <section className="table-card form-card audit-filter-card" aria-label="Filter activity"><form className="student-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied({ ...filters }) }}><div className="student-form-grid">
      <label>Action<select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">All actions</option>{options.actions.map((action) => <option key={action} value={action}>{formatAuditAction(action)}</option>)}</select></label>
      <label>Record type<select value={filters.table_name} onChange={(event) => setFilters({ ...filters, table_name: event.target.value })}><option value="">All record types</option>{options.record_types.map((type) => <option key={type} value={type}>{auditRecordType(type)}</option>)}</select></label>
      <label>From date<input type="date" value={filters.from_date} max={filters.to_date || undefined} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} /></label>
      <label>To date<input type="date" value={filters.to_date} min={filters.from_date || undefined} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} /></label>
    </div><div className="registration-review-actions"><button disabled={loading}>Apply filters</button><button type="button" className="secondary-button" onClick={() => { setFilters(initialFilters); setApplied(initialFilters); setPage(1) }} disabled={loading}>Clear</button></div></form></section>
    {error && <p className="error-message" role="alert">{error} <button type="button" onClick={() => load()}>Retry</button></p>}
    <section className="table-card audit-results-card" aria-busy={loading}><div className="table-header management-table-header"><div><h3>Recorded Activity</h3><p aria-live="polite">{loading ? 'Loading events…' : `${pagination.total} ${activeFilters.length ? 'matching ' : ''}events · ${entries.length ? `${(page - 1) * pagination.limit + 1}–${(page - 1) * pagination.limit + entries.length} shown` : '0 shown'}`}</p></div><div className="audit-results-tools"><span>Page {pagination.page} of {lastPage}</span><AsyncActionButton type="button" className="primary-action" busy={exporting} busyLabel="Generating Excel…" disabled={loading || Boolean(error) || pagination.total === 0} onClick={generateExcel} aria-describedby="audit-export-scope">Generate Excel</AsyncActionButton></div></div>
      <p id="audit-export-scope" className="audit-export-note">Export all activities matching the applied filters, across every page.</p>
      <p className="audit-export-note" role="status">{exportStatus}</p>
      {exportError && <p className="error-message" role="alert">{exportError} <button type="button" className="secondary-button" disabled={loading || Boolean(error) || pagination.total === 0 || exporting} onClick={generateExcel}>Retry Excel export</button></p>}
      {activeFilters.length > 0 && <div className="audit-active-filters" aria-label="Active filters">{activeFilters.map((label, index) => <span key={`${index}:${label}`}>{label}</span>)}</div>}
      {loading ? <p className="empty-state" aria-live="polite">Loading audit activity…</p> : !error && entries.length === 0 ? <p className="empty-state">No audit activity matches these filters.</p> : entries.length > 0 && <div className="table-wrap"><table className="audit-record-table"><colgroup><col className="audit-date-col"/><col className="audit-actor-col"/><col className="audit-action-col"/><col className="audit-record-col"/><col/></colgroup><thead><tr><th scope="col">Date</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Description</th></tr></thead><tbody>{entries.map((entry) => <AuditRow key={entry.id} entry={entry}/>)}</tbody></table></div>}
      <div className="registration-review-actions"><button type="button" className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className="secondary-button" disabled={loading || page >= lastPage} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </section>
  </section>
}
export default AdminAuditLog
