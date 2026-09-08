import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { duplicateSummaryTotal, duplicateTypeLabel } from '../lib/duplicateReview.js'

const SUMMARY_ITEMS = [
  ['student_number', 'Student number'],
  ['employee_number', 'Employee number'],
  ['username', 'Username'],
  ['google_identity', 'Google identity']
]

function AdminDuplicateReview({ token, embedded = false }) {
  const [conflicts, setConflicts] = useState([])
  const [summary, setSummary] = useState({})
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/admin/duplicate-review`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to review possible duplicates.')
      setConflicts(data.conflicts || [])
      setSummary(data.summary || {})
      setSelectedId((current) => current || data.conflicts?.[0]?.id || '')
    } catch (requestError) {
      setConflicts([])
      setSummary({})
      setSelectedId('')
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conflicts
    return conflicts.filter((conflict) => [duplicateTypeLabel(conflict.type), conflict.identifier, ...conflict.sources.map((source) => `${source.source_label} ${source.display}`)].join(' ').toLowerCase().includes(query))
  }, [conflicts, search])
  const selected = visible.find((conflict) => conflict.id === selectedId) || visible[0] || null

  return <section className="duplicate-workspace" aria-label={embedded ? 'Duplicate review' : undefined} aria-labelledby={embedded ? undefined : 'duplicate-review-title'}>
    {!embedded && <header className="management-page-header">
      <div><span className="page-breadcrumb">Home / Students / Duplicate Review</span><h2 id="duplicate-review-title">Duplicate Review</h2><p>Identify possible account conflicts while preserving every source record for audited review.</p></div>
      <span className="readonly-badge">Read-only review</span>
    </header>}

    <section className="management-metrics" aria-label="Duplicate review summary">
      {SUMMARY_ITEMS.map(([key, label], index) => <article className={`management-metric ${index === 1 ? 'metric-red' : index === 3 ? 'metric-orange' : index === 2 ? 'metric-green' : 'metric-blue'}`} key={key}><i>{index === 0 ? '◎' : index === 1 ? '!' : index === 2 ? '✓' : '◷'}</i><div><strong>{Number(summary[key]) || 0}</strong><span>{label} conflicts</span></div></article>)}
    </section>

    {error && <p className="error-message" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
    <div className="duplicate-review-grid">
      <section className="table-card duplicate-list-pane">
        <div className="table-header management-table-header"><div><h3>Possible Duplicate Records</h3><p>{duplicateSummaryTotal(summary)} conflicts require verification</p></div></div>
        <label className="duplicate-search"><span className="sr-only">Search conflicts</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search identifier, type, or source…" /></label>
        {loading ? <p className="empty-state" aria-live="polite">Checking account identifiers…</p> : !error && visible.length === 0 ? <div className="department-empty"><h4>No matching conflicts</h4><p>Active records and pending requests use distinct identifiers.</p></div> : <div className="duplicate-list">{visible.map((conflict) => <button type="button" key={conflict.id} className={selected?.id === conflict.id ? 'selected' : ''} onClick={() => setSelectedId(conflict.id)}><span><strong>{duplicateTypeLabel(conflict.type)}</strong><small>{conflict.identifier}</small></span><b>{conflict.occurrences} matches</b></button>)}</div>}
      </section>

      <section className="table-card duplicate-compare-pane">
        <div className="table-header management-table-header"><div><h3>Compare Source Records</h3><p>Confirm the school records before any separate audited account action.</p></div>{selected && <span>{selected.occurrences} sources</span>}</div>
        {!selected ? <p className="empty-state">Select a possible conflict to compare its sources.</p> : <>
          <div className="duplicate-match-banner"><span>{duplicateTypeLabel(selected.type)}</span><strong>{selected.identifier}</strong></div>
          <div className="duplicate-source-grid">{selected.sources.map((source, index) => <article key={`${source.source}-${source.record_id}-${index}`}><header><i>{String.fromCharCode(65 + index)}</i><div><strong>Record {String.fromCharCode(65 + index)}</strong><span>{source.source_label}</span></div></header><dl><div><dt>Source type</dt><dd>{source.source_label}</dd></div><div><dt>Displayed value</dt><dd>{source.display}</dd></div><div><dt>Internal record</dt><dd>#{source.record_id}</dd></div></dl></article>)}</div>
          <div className="duplicate-safety-note"><strong>No automatic merge is available.</strong><span>This workspace intentionally does not expose Google identity claims, delete records, or combine accounts.</span></div>
        </>}
      </section>
    </div>
  </section>
}

export default AdminDuplicateReview
