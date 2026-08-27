import { clearanceBlockers, clearanceLabel, summarizeClearance } from '../lib/studentClearance.js'

const displayDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function StudentClearance({ eligibility, records, loading, error }) {
  const summary = summarizeClearance({ eligibility, records })
  const blockers = clearanceBlockers(summary)

  if (loading) {
    return <section className="clearance-page" aria-live="polite"><div className="skeleton clearance-hero-skeleton" /><div className="skeleton clearance-record-skeleton" /></section>
  }

  return (
    <section className="clearance-page" aria-labelledby="clearance-title">
      <header className={`clearance-hero clearance-${summary.status.toLowerCase().replaceAll('_', '-')}`}>
        <div>
          <p className="eyebrow">Disciplinary clearance</p>
          <h2 id="clearance-title">{clearanceLabel(summary.status)}</h2>
          <p>{summary.status === 'CLEARED'
            ? 'Your latest clearance record has been approved.'
            : summary.eligible
              ? 'You have no current blockers and are awaiting approval.'
              : 'Complete the requirements below to become eligible.'}</p>
        </div>
        <span className="clearance-status-mark" aria-hidden="true">{summary.status === 'CLEARED' ? '✓' : summary.eligible ? '…' : '!'}</span>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      <section className="clearance-requirements" aria-labelledby="requirements-title">
        <div><p className="eyebrow">Current eligibility</p><h3 id="requirements-title">Requirements</h3></div>
        {blockers.length === 0 ? (
          <p className="clearance-ready">✓ No unresolved violation or service blockers.</p>
        ) : (
          <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
        )}
      </section>

      <section className="table-card clearance-history-card">
        <div className="table-header"><div><p className="eyebrow">Academic periods</p><h3>Clearance history</h3></div><span>{records.length} records</span></div>
        {records.length === 0 ? (
          <div className="clearance-empty"><h4>No clearance records yet</h4><p>Your eligibility is still shown above based on current requirements.</p></div>
        ) : (
          <div className="clearance-record-list">{records.map((record) => <article key={record.id}>
            <div><strong>{record.academic_year}</strong><span>{record.semester}</span></div>
            <span className={`status-badge status-${record.status.toLowerCase().replaceAll('_', '-')}`}>{clearanceLabel(record.status)}</span>
            <dl><div><dt>Approved</dt><dd>{record.cleared_at ? displayDate(record.cleared_at) : '—'}</dd></div><div><dt>Remarks</dt><dd>{record.remarks || 'No remarks'}</dd></div></dl>
          </article>)}</div>
        )}
      </section>

      <p className="scope-note">Clearance is calculated from your own authenticated student record. Contact the Discipline Office if a record appears incorrect.</p>
    </section>
  )
}

export default StudentClearance
