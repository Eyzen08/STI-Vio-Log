import { nonComplianceSummary, readableIncidentDate } from '../lib/departmentNonCompliance.js'

function DepartmentNonCompliance({ report, loading, error, sortBy, onSort }) {
  const rows = Array.isArray(report?.data) ? report.data : []
  const summary = nonComplianceSummary(report)
  return <div className="department-noncompliance">
    <section className="department-welcome"><div><p className="eyebrow">Follow-up queue</p><h2>Non-compliance</h2><p>Students served by your department who still have open disciplinary requirements.</p></div></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="stats-grid department-stats" aria-label="Non-compliance summary"><article className="stat-card"><span>Students requiring follow-up</span><strong>{summary.students}</strong></article><article className="stat-card"><span>Open violations</span><strong>{summary.openViolations}</strong></article><article className="stat-card"><span>Pending hours</span><strong>{summary.pendingHours.toFixed(2)}</strong></article></section>
    <section className="noncompliance-toolbar"><label><span>Prioritize by</span><select value={sortBy} onChange={(event) => onSort(event.target.value)} disabled={loading}><option value="date">Most recent violation</option><option value="hours">Most pending hours</option><option value="violations">Most violations</option></select></label></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">Department-scoped queue</p><h3>Students requiring follow-up</h3></div><span>{rows.length} records</span></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Loading non-compliance report…</p></div> : rows.length === 0 ? <div className="department-empty"><h4>No non-compliant students</h4><p>No students served by your department currently have open requirements.</p></div> : <div className="noncompliance-list">{rows.map((row) => <article key={row.id}><div><h4>{row.first_name} {row.last_name}</h4><span>{row.student_number} · {row.program || 'Program not provided'} · Year {row.year_level || '—'}</span></div><dl><div><dt>Open violations</dt><dd>{row.open_violations}</dd></div><div><dt>Pending service</dt><dd>{Number(row.pending_hours || 0).toFixed(2)} hrs</dd></div><div><dt>Latest violation</dt><dd>{readableIncidentDate(row.last_violation_date)}</dd></div></dl></article>)}</div>}
    </section><p className="scope-note">This is a read-only follow-up view. Disciplinary decisions remain with authorized Discipline Office staff.</p>
  </div>
}
export default DepartmentNonCompliance
