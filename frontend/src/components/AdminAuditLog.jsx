import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { auditActorLabel, buildAuditQuery, formatAuditAction } from '../lib/auditLog.js'

const initialFilters = { action: '', table_name: '', from_date: '', to_date: '' }

function AdminAuditLog({ token }) {
  const [filters, setFilters] = useState(initialFilters)
  const [applied, setApplied] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API_URL}/api/audit-logs?${buildAuditQuery(applied, page)}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to load audit activity.')
      setEntries(data.audit_logs || []); setPagination(data.pagination || { page, limit: 25, total: 0 })
    } catch (loadError) { setEntries([]); setError(loadError.message) } finally { setLoading(false) }
  }, [applied, page, token])
  useEffect(() => { load() }, [load])
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.limit))

  return <section className="registration-review-page">
    <div className="department-welcome"><div><p className="eyebrow">System administration</p><h2>Audit Log</h2><p>Review security and account activity. Sensitive identity and authentication values are never displayed.</p></div><span className="status-badge">{pagination.total} events</span></div>
    <section className="table-card form-card"><div className="table-header"><h3>Filter activity</h3></div><form className="student-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters) }}><div className="student-form-grid">
      <label>Action<input value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} placeholder="ACCOUNT_CREATE" /></label>
      <label>Record type<input value={filters.table_name} onChange={(event) => setFilters({ ...filters, table_name: event.target.value })} placeholder="users" /></label>
      <label>From date<input type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} /></label>
      <label>To date<input type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} /></label>
    </div><div className="registration-review-actions"><button disabled={loading}>Apply filters</button><button type="button" className="secondary-button" onClick={() => { setFilters(initialFilters); setApplied(initialFilters); setPage(1) }} disabled={loading}>Clear</button></div></form></section>
    {error && <p className="error-message" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
    <section className="table-card"><div className="table-header"><h3>Recorded activity</h3><span>Page {pagination.page} of {lastPage}</span></div>
      {loading ? <p className="empty-state" aria-live="polite">Loading audit activity…</p> : !error && entries.length === 0 ? <p className="empty-state">No audit activity matches these filters.</p> : entries.length > 0 && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Record</th><th>Description</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString()}</td><td>{auditActorLabel(entry)}<br /><small>{entry.actor_role?.replaceAll('_', ' ') || 'SYSTEM'}</small></td><td><span className="status-badge">{formatAuditAction(entry.action)}</span></td><td>{entry.table_name || '—'}{entry.record_id ? ` #${entry.record_id}` : ''}</td><td>{entry.description || '—'}</td></tr>)}</tbody></table></div>}
      <div className="registration-review-actions"><button type="button" className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className="secondary-button" disabled={loading || page >= lastPage} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </section>
  </section>
}
export default AdminAuditLog
