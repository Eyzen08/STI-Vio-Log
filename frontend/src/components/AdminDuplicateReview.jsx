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
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sort, setSort] = useState('MOST_MATCHES')
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
    return conflicts
      .filter((conflict) => (typeFilter === 'ALL' || conflict.type === typeFilter) && (!query || [duplicateTypeLabel(conflict.type), conflict.identifier, ...conflict.sources.map((source) => `${source.source_label} ${source.display}`)].join(' ').toLowerCase().includes(query)))
      .sort((a, b) => sort === 'IDENTIFIER' ? String(a.identifier).localeCompare(String(b.identifier)) : Number(b.occurrences) - Number(a.occurrences))
  }, [conflicts, search, sort, typeFilter])
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
    <div className={`duplicate-review-grid${!loading && !error && conflicts.length === 0 ? ' duplicate-review-grid--empty' : ''}`}>
      <section className="table-card duplicate-list-pane">
        <div className="table-header management-table-header"><div><h3>Possible Duplicate Records</h3><p>{duplicateSummaryTotal(summary)} conflicts require verification</p></div></div>
        <div className="duplicate-filters"><label><span className="sr-only">Search conflicts</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, identifier, username, or source…" /></label><label><span>Conflict type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All conflict types</option>{SUMMARY_ITEMS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="MOST_MATCHES">Most matches</option><option value="IDENTIFIER">Identifier A–Z</option></select></label>{(search || typeFilter !== 'ALL' || sort !== 'MOST_MATCHES') && <button type="button" onClick={() => { setSearch(''); setTypeFilter('ALL'); setSort('MOST_MATCHES') }}>Clear filters</button>}</div>
        {loading ? <div className="duplicate-skeleton" aria-live="polite"><span/><span/><span/><p>Checking account identifiers…</p></div> : !error && visible.length === 0 ? <div className="department-empty"><h4>{conflicts.length ? 'No search results' : 'No conflicts found'}</h4><p>{conflicts.length ? 'Try changing or clearing the filters.' : 'Active records and pending requests use distinct identifiers.'}</p>{conflicts.length > 0 && <button type="button" onClick={() => { setSearch(''); setTypeFilter('ALL') }}>Clear filters</button>}</div> : <div className="duplicate-list">{visible.map((conflict) => <button type="button" key={conflict.id} className={selected?.id === conflict.id ? 'selected' : ''} onClick={() => setSelectedId(conflict.id)}><span><strong>{duplicateTypeLabel(conflict.type)}</strong><small>{conflict.identifier}</small></span><b>{conflict.occurrences} matches</b></button>)}</div>}
      </section>

      {(loading || error || conflicts.length > 0) && <section className="table-card duplicate-compare-pane">
        <div className="table-header management-table-header"><div><h3>Compare Source Records</h3><p>Confirm the school records before any separate audited account action.</p></div>{selected && <span>{selected.occurrences} sources</span>}</div>
        {!selected ? <p className="empty-state">Select a possible conflict to compare its sources.</p> : <>
          <div className="duplicate-match-banner"><span>{duplicateTypeLabel(selected.type)}</span><strong>{selected.identifier}</strong></div>
          <div className="duplicate-source-grid">{selected.sources.map((source, index) => <article key={`${source.source}-${source.record_id}-${index}`}><header><i>{String.fromCharCode(65 + index)}</i><div><strong>Record {String.fromCharCode(65 + index)}</strong><span>{source.source_label}</span></div></header><dl><div><dt>Conflict field</dt><dd>{duplicateTypeLabel(selected.type)}</dd></div><div><dt>Displayed value</dt><dd>{source.display}</dd></div><div><dt>Source</dt><dd>{source.source_label}</dd></div><div><dt>Comparison</dt><dd><span className="match-label">● Exact identifier match</span></dd></div></dl></article>)}</div>
          <div className="duplicate-safety-note"><strong>No automatic merge is available.</strong><span>This workspace intentionally does not expose Google identity claims, delete records, or combine accounts.</span></div>
        </>}
      </section>}
    </div>
  </section>
}

export default AdminDuplicateReview
