import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'

function GoogleRegistrationReview({ token, onPendingCountChange }) {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reasonById, setReasonById] = useState({})
  const [verificationById, setVerificationById] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/google-registrations?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to load registration requests.')
      setRegistrations(Array.isArray(data.registrations) ? data.registrations : [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => { onPendingCountChange?.(registrations.length) }, [registrations.length, onPendingCountChange])

  const review = async (registration, decision) => {
    const reason = String(reasonById[registration.id] || '').trim()
    if (!reason) {
      setError('Enter a review reason before approving or rejecting a request.')
      return
    }
    const verification = verificationById[registration.id] || {}
    if (decision === 'approve' && (!verification.academic_year || !verification.semester || !verification.verification_method || !verification.verification_reference)) {
      setError('Complete the academic period, verification method, and official reference before approval.')
      return
    }
    setBusyId(registration.id)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/google-registrations/${registration.id}/${decision}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'approve' ? { reason, ...verification } : { reason })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to review this registration.')
      setRegistrations((current) => current.filter((item) => item.id !== registration.id))
      setReasonById((current) => { const next = { ...current }; delete next[registration.id]; return next })
      setVerificationById((current) => { const next = { ...current }; delete next[registration.id]; return next })
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="registration-review-page" aria-labelledby="registration-review-title">
      <div className="department-welcome">
        <div><p className="eyebrow">Enrollment verification</p><h2 id="registration-review-title">Google student registrations</h2><p>Verify each applicant against official enrollment records before granting portal access.</p></div>
        <span className="status-badge">{registrations.length} pending</span>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {loading ? (
        <section className="table-card" aria-busy="true"><p className="empty-state">Loading registration requests…</p></section>
      ) : registrations.length === 0 ? (
        <section className="table-card"><div className="department-empty"><h4>No pending registrations</h4><p>New Google student requests will appear here for verification.</p></div></section>
      ) : (
        <div className="registration-review-list">
          {registrations.map((registration) => (
            <article className="table-card" key={registration.id}>
              <div className="registration-review-heading">
                <div><h3>{registration.first_name} {registration.last_name}</h3><p>{registration.student_number}</p></div>
                <span className="status-badge">Pending</span>
              </div>
              <dl>
                <div><dt>Google account</dt><dd>{registration.google_email || 'Verified identity; email unavailable'}</dd></div>
                <div><dt>Student phone</dt><dd>{registration.phone_number}</dd></div>
                <div><dt>Enrollment</dt><dd>{registration.program} · Year {registration.year_level} · {registration.section}</dd></div>
                <div><dt>Parent/Guardian</dt><dd>{registration.guardian_name} ({registration.guardian_relationship})</dd></div>
                <div><dt>Parent/Guardian phone</dt><dd>{registration.guardian_phone_number}</dd></div>
                <div><dt>Submitted</dt><dd>{new Date(registration.created_at).toLocaleString()}</dd></div>
              </dl>
              <fieldset className="enrollment-verification-fields" disabled={busyId === registration.id}>
                <legend>Official enrollment verification</legend>
                <label>Academic year<input value={verificationById[registration.id]?.academic_year || ''} placeholder="2026-2027" maxLength="20" onChange={(event) => setVerificationById({ ...verificationById, [registration.id]: { ...verificationById[registration.id], academic_year: event.target.value } })} /></label>
                <label>Semester<select value={verificationById[registration.id]?.semester || ''} onChange={(event) => setVerificationById({ ...verificationById, [registration.id]: { ...verificationById[registration.id], semester: event.target.value } })}><option value="">Select semester</option><option>First Semester</option><option>Second Semester</option><option>Summer</option></select></label>
                <label>Verification method<select value={verificationById[registration.id]?.verification_method || ''} onChange={(event) => setVerificationById({ ...verificationById, [registration.id]: { ...verificationById[registration.id], verification_method: event.target.value } })}><option value="">Select source</option><option value="REGISTRAR_RECORD">Registrar record</option><option value="SIS">Student information system</option><option value="ENROLLMENT_LIST">Official enrollment list</option><option value="OTHER">Other official source</option></select></label>
                <label>Official reference<input value={verificationById[registration.id]?.verification_reference || ''} placeholder="Record, receipt, or enrollment reference" maxLength="200" onChange={(event) => setVerificationById({ ...verificationById, [registration.id]: { ...verificationById[registration.id], verification_reference: event.target.value } })} /></label>
              </fieldset>
              <label htmlFor={`review-reason-${registration.id}`}>Review reason
                <textarea id={`review-reason-${registration.id}`} value={reasonById[registration.id] || ''}
                  onChange={(event) => setReasonById({ ...reasonById, [registration.id]: event.target.value })}
                  placeholder="Reference the enrollment verification performed" maxLength="1000" disabled={busyId === registration.id} />
              </label>
              <div className="registration-review-actions">
                <button type="button" onClick={() => review(registration, 'approve')} disabled={busyId === registration.id}>Approve enrollment</button>
                <button type="button" className="danger-button" onClick={() => review(registration, 'reject')} disabled={busyId === registration.id}>Reject request</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default GoogleRegistrationReview
