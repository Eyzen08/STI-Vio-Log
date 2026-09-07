import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatManilaDate, formatManilaDateTime } from '../lib/displayFormat.js'
import Modal from './Modal.jsx'

const fullName = (registration) => [registration.first_name, registration.middle_name, registration.last_name, registration.suffix].filter(Boolean).join(' ')

function GoogleRegistrationReview({ token, onPendingCountChange }) {
  const [registrations, setRegistrations] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reasonById, setReasonById] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/google-registrations?status=PENDING`, { headers: { Authorization: `Bearer ${token}` } })
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
    if (!reason) return setError('Enter a review reason before approving or rejecting a request.')
    setBusyId(registration.id)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/google-registrations/${registration.id}/${decision}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to review this registration.')
      setRegistrations((current) => current.filter((item) => item.id !== registration.id))
      setReasonById((current) => { const next = { ...current }; delete next[registration.id]; return next })
      setSelected(null)
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setBusyId(null)
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return registrations
    return registrations.filter((item) => [fullName(item), item.student_number, item.program, item.section, item.guardian_name].filter(Boolean).join(' ').toLowerCase().includes(query))
  }, [registrations, search])
  const uniquePrograms = new Set(registrations.map((item) => item.program).filter(Boolean)).size
  const uniqueYearLevels = new Set(registrations.map((item) => item.year_level).filter(Boolean)).size
  const submittedToday = registrations.filter((item) => new Date(item.created_at).toDateString() === new Date().toDateString()).length

  return <section className="registration-management" aria-labelledby="registration-review-title">
    <header className="management-page-header"><div><span className="page-breadcrumb">Home / Registrations</span><h2 id="registration-review-title">Student Registrations</h2><p>Review submitted profiles before granting access to Discipline Office services.</p></div><span className="readonly-badge">Identity review</span></header>
    <section className="management-metrics" aria-label="Pending registration summary">
      <article className="management-metric metric-orange"><i>◷</i><div><strong>{registrations.length}</strong><span>Pending Review</span></div></article>
      <article className="management-metric metric-blue"><i>□</i><div><strong>{uniquePrograms}</strong><span>Programs Represented</span></div></article>
      <article className="management-metric metric-green"><i>◎</i><div><strong>{uniqueYearLevels}</strong><span>Year Levels</span></div></article>
      <article className="management-metric metric-purple"><i>＋</i><div><strong>{submittedToday}</strong><span>Submitted Today</span></div></article>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="table-card registration-directory">
      <div className="table-header management-table-header"><div><h3>Registration Queue</h3><p>Only pending requests are shown.</p></div><span>{visible.length} requests</span></div>
      <div className="directory-toolbar registration-toolbar"><input type="search" aria-label="Search registrations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, student number, program, section, or guardian…" /></div>
      {loading ? <p className="empty-state" aria-live="polite">Loading registration requests…</p> : visible.length === 0 ? <div className="department-empty"><h4>{registrations.length ? 'No matching registrations' : 'No pending registrations'}</h4><p>{registrations.length ? 'Adjust your search to see more requests.' : 'New student requests will appear here for review.'}</p></div> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student Number</th><th>Program</th><th>Year &amp; Section</th><th>Guardian</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{visible.map((registration) => <tr key={registration.id}><td><strong>{fullName(registration)}</strong><small>{registration.google_email || 'Verified Google identity'}</small></td><td>{registration.student_number}</td><td>{registration.program || '—'}</td><td>{registration.year_level ? `Year ${registration.year_level}` : '—'} · {registration.section || '—'}</td><td>{registration.guardian_name || '—'}</td><td>{formatManilaDate(registration.created_at)}</td><td><button type="button" className="primary-row-action" onClick={() => { setError(''); setSelected(registration) }}>Review</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected && <Modal title={`Review registration — ${selected.student_number}`} drawer onClose={() => !busyId && setSelected(null)}><div className="registration-review-drawer"><header><span className="profile-initials">{selected.first_name?.[0]}{selected.last_name?.[0]}</span><div><h3>{fullName(selected)}</h3><p>{selected.student_number}</p><mark>Pending Review</mark></div></header><dl><div><dt>Google account</dt><dd>{selected.google_email || 'Verified identity; email unavailable'}</dd></div><div><dt>Student phone</dt><dd>{selected.phone_number || 'Not provided'}</dd></div><div><dt>Academic details</dt><dd>{selected.program || '—'} · Year {selected.year_level || '—'} · {selected.section || '—'}</dd></div><div><dt>Parent/Guardian</dt><dd>{selected.guardian_name || 'Not provided'}{selected.guardian_relationship ? ` (${selected.guardian_relationship})` : ''}</dd></div><div><dt>Guardian phone</dt><dd>{selected.guardian_phone_number || 'Not provided'}</dd></div><div><dt>Submitted</dt><dd>{formatManilaDateTime(selected.created_at)}</dd></div></dl><label>Discipline Office review note<textarea value={reasonById[selected.id] || ''} onChange={(event) => setReasonById({ ...reasonById, [selected.id]: event.target.value })} placeholder="Document how the submitted information was verified" maxLength="1000" disabled={busyId === selected.id} /></label>{error && <p className="error-message" role="alert">{error}</p>}<div className="drawer-action-row"><button type="button" className="danger-button" onClick={() => review(selected, 'reject')} disabled={busyId === selected.id}>Reject Request</button><button type="button" onClick={() => review(selected, 'approve')} disabled={busyId === selected.id}>{busyId === selected.id ? 'Saving…' : 'Approve Student Access'}</button></div></div></Modal>}
  </section>
}

export default GoogleRegistrationReview
