import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { buildParentContactPayload, CONTACT_METHODS, CONTACT_OUTCOMES, contactLabel } from '../lib/parentContact.js'

function GuardianContactPanel({ token, student, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ guardianId: '', method: 'CALL', outcome: 'REACHED', notes: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await apiRequest(`/api/parent-contact/${student.id}`, { headers: { Authorization: `Bearer ${token}` } })
      setData(result)
      setForm((current) => ({ ...current, guardianId: current.guardianId || String(result.guardians?.[0]?.id || '') }))
    } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }, [student.id, token])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await apiRequest(`/api/parent-contact/${student.id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildParentContactPayload(form)) })
      setForm((current) => ({ ...current, notes: '' })); await load()
    } catch (saveError) { setError(saveError.message) } finally { setSaving(false) }
  }

  const guardians = data?.guardians || []
  const contacts = data?.contacts || []
  return (
    <section className="table-card guardian-contact-panel" aria-busy={loading}>
      <div className="table-header"><div><p className="eyebrow">Private contact record</p><h3>{student.studentNumber || student.student_number} — {student.name || `${student.first_name} ${student.last_name}`}</h3></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {loading && !data ? <p className="empty-state">Loading guardian contact…</p> : guardians.length === 0 ? <p className="empty-state">No parent or guardian contact is recorded.</p> : <>
        <div className="guardian-contact-grid">{guardians.map((guardian) => <article key={guardian.id}><div><h4>{guardian.guardian_name}</h4><p>{guardian.relationship || 'Relationship not provided'}{guardian.is_primary ? ' · Primary contact' : ''}</p></div><strong>{guardian.phone_number}</strong><div className="guardian-contact-actions"><a href={`tel:${guardian.phone_number}`}>Call</a><a href={`sms:${guardian.phone_number}`}>Message</a></div></article>)}</div>
        <form className="student-form guardian-contact-form" onSubmit={submit}>
          <div className="student-form-grid"><label>Parent/Guardian<select value={form.guardianId} onChange={(event) => setForm({ ...form, guardianId: event.target.value })} required>{guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.guardian_name}</option>)}</select></label><label>Contact method<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{CONTACT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Outcome<select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}>{CONTACT_OUTCOMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength="1000" placeholder="Optional factual follow-up note" /></label></div>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record contact attempt'}</button>
        </form>
        <div className="registration-review-list"><div className="table-header"><h3>Contact history</h3><span>{contacts.length} records</span></div>{contacts.length === 0 ? <p className="empty-state">No contact attempts recorded yet.</p> : contacts.map((contact) => <article key={contact.id}><div className="registration-review-heading"><div><h4>{contactLabel(contact.contact_method)} · {contactLabel(contact.outcome)}</h4><p>{new Date(contact.created_at).toLocaleString()}</p></div><span className="status-badge">{contact.contacted_by_role.replaceAll('_', ' ')}</span></div><p>{contact.notes || 'No notes recorded.'}</p><small>{[contact.contacted_by_first_name, contact.contacted_by_last_name].filter(Boolean).join(' ')}{contact.department_name ? ` · ${contact.department_name}` : ''}</small></article>)}</div>
      </>}
      <p className="scope-note">Guardian information is private. Use it only for authorized student support and discipline follow-up.</p>
    </section>
  )
}

export default GuardianContactPanel

