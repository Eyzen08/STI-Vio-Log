import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'

function GoogleRegistrationReview({ token, onPendingCountChange }) {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reasonById, setReasonById] = useState({})
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
    setBusyId(registration.id)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/google-registrations/${registration.id}/${decision}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to review this registration.')
      setRegistrations((current) => current.filter((item) => item.id !== registration.id))
      setReasonById((current) => { const next = { ...current }; delete next[registration.id]; return next })
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="registration-review-page" aria-labelledby="registration-review-title">
      <div className="department-welcome">
        <div><p className="eyebrow">Student record review</p><h2 id="registration-review-title">Google student registrations</h2><p>Review the submitted student profile before granting access to Discipline Office services.</p></div>
        <span className="status-badge">{registrations.length} pending</span>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {loading ? (
        <section className="table-card" aria-busy="true"><p className="empty-state">Loading registration requests…</p></section>
      ) : registrations.length === 0 ? (
        <section className="table-card"><div className="department-empty"><h4>No pending registrations</h4><p>New Google student requests will appear here for review.</p></div></section>
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
                <div><dt>Student details</dt><dd>{registration.program} · Year {registration.year_level} · {registration.section}</dd></div>
                <div><dt>Parent/Guardian</dt><dd>{registration.guardian_name} ({registration.guardian_relationship})</dd></div>
                <div><dt>Parent/Guardian phone</dt><dd>{registration.guardian_phone_number}</dd></div>
                <div><dt>Submitted</dt><dd>{new Date(registration.created_at).toLocaleString()}</dd></div>
              </dl>
              <label htmlFor={`review-reason-${registration.id}`}>Discipline Office review note
                <textarea id={`review-reason-${registration.id}`} value={reasonById[registration.id] || ''}
                  onChange={(event) => setReasonById({ ...reasonById, [registration.id]: event.target.value })}
                  placeholder="Example: Student details reviewed for portal access" maxLength="1000" disabled={busyId === registration.id} />
              </label>
              <div className="registration-review-actions">
                <button type="button" onClick={() => review(registration, 'approve')} disabled={busyId === registration.id}>Approve student access</button>
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
