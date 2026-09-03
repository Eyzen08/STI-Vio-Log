import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { clearanceBlockers, clearanceLabel, summarizeClearance } from '../lib/studentClearance.js'

const displayDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function StudentClearance({ eligibility, records, loading, error, certificate, onLoadCertificate, token }) {
  const summary = summarizeClearance({ eligibility, records })
  const blockers = clearanceBlockers(summary)
  const [issuedCertificates, setIssuedCertificates] = useState([])
  const [certificateHistoryError, setCertificateHistoryError] = useState('')
  useEffect(() => {
    fetch(`${API_URL}/api/student/clearance/certificates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to load certificates'); return data })
      .then((data) => setIssuedCertificates(data.certificates || []))
      .catch((requestError) => setCertificateHistoryError(requestError.message))
  }, [token])
  const download = async (entry) => {
    setCertificateHistoryError('')
    try {
      const response = await fetch(`${API_URL}/api/student/clearance/certificates/${entry.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Unable to download certificate')
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${entry.certificate_number}.pdf`; anchor.click(); URL.revokeObjectURL(url)
    } catch (requestError) { setCertificateHistoryError(requestError.message) }
  }

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
        <button type="button" onClick={certificate ? () => download(certificate) : onLoadCertificate}>{certificate ? 'Download issued PDF' : 'Check issued certificate'}</button>
      </section>}

      {certificate && summary.status === 'CLEARED' && summary.eligible && <section className="clearance-certificate" aria-label="Good-standing certificate">
        <p className="eyebrow">STI Student Services</p><h2>Certificate of Good Standing</h2>
        <p>This certifies that</p><strong>{certificate.student_name}</strong><p>Student Number {certificate.student_number}</p>
        <p>has an approved disciplinary clearance for {certificate.semester}, Academic Year {certificate.academic_year}, and has no current violation or community-service blockers.</p>
        <dl><div><dt>Certificate reference</dt><dd>{certificate.certificate_code}</dd></div><div><dt>Approved</dt><dd>{displayDate(certificate.cleared_at)}</dd></div></dl>
        <small>Verify using GET /api/certificates/clearance/{certificate.certificate_code}</small>
      </section>}

      <section className="table-card clearance-history-card"><div className="table-header"><div><p className="eyebrow">Permanent documents</p><h3>Issued certificates</h3></div><span>{issuedCertificates.length} records</span></div>
        {certificateHistoryError && <p className="error-message" role="alert">{certificateHistoryError}</p>}
        {issuedCertificates.length === 0 ? <div className="clearance-empty"><h4>No certificate issued yet</h4><p>The Discipline Office will issue one after final approval.</p></div> : <div className="clearance-record-list">{issuedCertificates.map((entry) => <article key={entry.id}><div><strong>{entry.certificate_number}</strong><span>Version {entry.version}</span></div><span className={`status-badge status-${entry.status.toLowerCase()}`}>{entry.status}</span><dl><div><dt>Issued</dt><dd>{displayDate(entry.issue_date)}</dd></div><div><dt>Hours</dt><dd>{entry.completed_hours}</dd></div></dl><button type="button" onClick={() => download(entry)}>Download PDF</button></article>)}</div>}
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
