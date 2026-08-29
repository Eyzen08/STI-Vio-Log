import { clearanceBlockers, clearanceLabel, summarizeClearance } from '../lib/studentClearance.js'

const displayDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function StudentClearance({ eligibility, records, loading, error, certificate, onLoadCertificate }) {
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

      {summary.status === 'CLEARED' && summary.eligible && <section className="clearance-certificate-actions">
        <div><p className="eyebrow">Good standing document</p><h3>Clearance certificate</h3><p>Generate a server-verified certificate for your currently approved clearance.</p></div>
        <button type="button" onClick={certificate ? () => window.print() : onLoadCertificate}>{certificate ? 'Print or save PDF' : 'Generate certificate'}</button>
      </section>}

      {certificate && summary.status === 'CLEARED' && summary.eligible && <section className="clearance-certificate" aria-label="Good-standing certificate">
        <p className="eyebrow">STI Student Services</p><h2>Certificate of Good Standing</h2>
        <p>This certifies that</p><strong>{certificate.student_name}</strong><p>Student Number {certificate.student_number}</p>
        <p>has an approved disciplinary clearance for {certificate.semester}, Academic Year {certificate.academic_year}, and has no current violation or community-service blockers.</p>
        <dl><div><dt>Certificate reference</dt><dd>{certificate.certificate_code}</dd></div><div><dt>Approved</dt><dd>{displayDate(certificate.cleared_at)}</dd></div></dl>
        <small>Verify using GET /api/certificates/clearance/{certificate.certificate_code}</small>
      </section>}

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
