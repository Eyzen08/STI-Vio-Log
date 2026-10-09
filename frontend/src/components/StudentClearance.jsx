import { useEffect, useState } from 'react'
import { notificationTarget } from '../lib/studentNotifications.js'
import RecordTargetFocus from './RecordTargetFocus.jsx'
import { API_URL } from '../lib/api.js'
import { clearanceBlockers, clearanceLabel, summarizeClearance } from '../lib/studentClearance.js'
import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import '../styles/student-portal.css'

const displayDate = (value) => formatManilaDateTime(value, '—')

function StudentClearance({ eligibility, records = [], loading, error, certificate, onLoadCertificate, token, onNavigate, searchParams = '' }) {
  const target = notificationTarget(searchParams)
  const summary = summarizeClearance({ eligibility, records })
  const blockers = clearanceBlockers(summary)
  const [issuedCertificates, setIssuedCertificates] = useState([])
  const [certificateHistoryError, setCertificateHistoryError] = useState('')
  const [certificatesLoading, setCertificatesLoading] = useState(true)
  useEffect(() => {
    let current = true
    setCertificatesLoading(true)
    fetch(`${API_URL}/api/student/clearance/certificates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to load certificates'); return data })
      .then((data) => { if (current) { setIssuedCertificates(data.certificates || []); setCertificateHistoryError('') } })
      .catch((requestError) => { if (current) setCertificateHistoryError(requestError.message) })
      .finally(() => { if (current) setCertificatesLoading(false) })
    return () => { current = false }
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
    return <section className="student-page clearance-page" aria-live="polite"><div className="skeleton clearance-hero-skeleton" /><div className="skeleton clearance-record-skeleton" /></section>
  }

  return (
    <section className="student-page clearance-page" aria-labelledby="clearance-title">
      <RecordTargetFocus id={target.invalid ? null : target.certificateId ? `certificate-record-${target.certificateId}` : target.clearanceId ? `clearance-record-${target.clearanceId}` : null} loading={loading || (Boolean(target.certificateId) && certificatesLoading)} error={error || (Boolean(target.certificateId) && certificateHistoryError)} />
      <section className="student-section student-eligibility">
      <header className={`student-clearance-status clearance-${summary.status.toLowerCase().replaceAll('_', '-')}`}>
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
        <h3 id="requirements-title">Requirements</h3>
        {blockers.length === 0 ? (
          <p className="clearance-ready">✓ No unresolved violation or service blockers.</p>
        ) : (
          <ul>{blockers.map((blocker) => <li key={blocker}><span>{blocker}</span><button type="button" className="text-button" onClick={()=>onNavigate?.(blocker === 'Resolve all open violations.' ? '/student/violations' : '/student/community-service')}>{blocker === 'Resolve all open violations.' ? 'View violations' : 'View service'}</button></li>)}</ul>
        )}
      </section>
      </section>

      {summary.status === 'CLEARED' && summary.eligible && <section className="clearance-certificate-actions">
        <div><h3>Clearance certificate</h3><p>Check the certificate issued for your approved clearance.</p></div>
        <button type="button" onClick={certificate ? () => download(certificate) : onLoadCertificate}>{certificate ? 'Download issued PDF' : 'Check issued certificate'}</button>
      </section>}

      {certificate && summary.status === 'CLEARED' && summary.eligible && <section className="clearance-certificate" aria-label="Good-standing certificate">
        <p className="eyebrow">STI Student Services</p><h2>Certificate of Good Standing</h2>
        <p>This certifies that</p><strong>{certificate.student_name}</strong><p>Student Number {certificate.student_number}</p>
        <p>has an approved disciplinary clearance for {certificate.semester}, Academic Year {certificate.academic_year}, and has no current violation or community-service blockers.</p>
        <dl><div><dt>Certificate reference</dt><dd>{certificate.certificate_code}</dd></div><div><dt>Approved</dt><dd>{displayDate(certificate.cleared_at)}</dd></div></dl>
      </section>}

      <section className="student-section clearance-history-card"><div className="student-section-heading"><h3>Issued certificates</h3><span>{certificatesLoading ? '…' : `${issuedCertificates.length} records`}</span></div>
        {certificateHistoryError && <p className="error-message" role="alert">{certificateHistoryError}</p>}
        {certificatesLoading ? <p role="status">Loading certificates…</p> : !certificateHistoryError && issuedCertificates.length === 0 ? <p className="student-empty">No certificate issued yet. The Discipline Office will issue one after final approval.</p> : <div className="clearance-record-list">{issuedCertificates.map((entry) => <article key={entry.id} id={`certificate-record-${entry.id}`} tabIndex={-1}><div><strong>{entry.certificate_number}</strong><span>Version {entry.version}</span></div><span className={`status-badge status-${entry.status.toLowerCase()}`}>{entry.status}</span><dl><div><dt>Issued</dt><dd>{displayDate(entry.issue_date)}</dd></div><div><dt>Completed service</dt><dd>{formatDuration(entry.completed_hours)}</dd></div></dl><button type="button" onClick={() => download(entry)}>Download PDF</button></article>)}</div>}
      </section>

      <section className="student-section clearance-history-card">
        <div className="student-section-heading"><h3>Clearance history</h3><span>{records.length} records</span></div>
        {records.length === 0 ? (
          <p className="student-empty">No clearance records yet.</p>
        ) : (
          <div className="clearance-record-list">{records.map((record) => <article key={record.id} id={`clearance-record-${record.id}`} tabIndex={-1}>
            <div><strong>{record.academic_year}</strong><span>{record.semester}</span></div>
            <span className={`status-badge status-${record.status.toLowerCase().replaceAll('_', '-')}`}>{clearanceLabel(record.status)}</span>
            <dl><div><dt>Approved</dt><dd>{record.cleared_at ? displayDate(record.cleared_at) : '—'}</dd></div><div><dt>Remarks</dt><dd>{record.remarks || 'No remarks'}</dd></div></dl>
          </article>)}</div>
        )}
      </section>

      <p className="student-caption">Contact the Discipline Office if a record appears incorrect.</p>
    </section>
  )
}

export default StudentClearance
