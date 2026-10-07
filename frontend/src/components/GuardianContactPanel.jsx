import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api.js'
import { buildParentContactPayload, CONTACT_METHODS, CONTACT_OUTCOMES, contactLabel } from '../lib/parentContact.js'
import { formatManilaDateTime } from '../lib/displayFormat.js'
import PortalIcon from './PortalIcon.jsx'
import '../styles/student-action-drawers.css'

function GuardianContactPanel({ token, student, onClose, showClose = true }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ guardianId: '', method: 'CALL', outcome: 'REACHED', notes: '' })
  const [historyLimit, setHistoryLimit] = useState(5)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest(`/api/parent-contact/${student.id}`, { headers: { Authorization: `Bearer ${token}` } })
      setData(result)
      setForm((current) => ({ ...current, guardianId: current.guardianId || String(result.guardians?.[0]?.id || '') }))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [student.id, token])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/parent-contact/${student.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildParentContactPayload(form))
      })
      setForm((current) => ({ ...current, notes: '' }))
      await load()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const guardians = data?.guardians || []
  const contacts = data?.contacts || []
  const studentName = student.name || `${student.first_name} ${student.last_name}`
  const studentNumber = student.studentNumber || student.student_number

  return <section className="guardian-contact-panel student-action-content" aria-busy={loading} aria-label={`Guardian Contact for ${studentName}`}>
    <header className="guardian-student-context"><i><PortalIcon name="user" size={24}/></i><div><h3>{studentName}</h3><p>Student • {studentNumber}</p></div>
      {showClose && <button type="button" className="secondary-button" onClick={onClose}>Close Guardian Contact</button>}
    </header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {loading && !data ? <p className="empty-state" aria-live="polite">Loading Guardian Contact…</p> : guardians.length === 0 ? <p className="empty-state">No Guardian Contact is recorded.</p> : <>
      <div className="guardian-contact-grid">
        {guardians.map((guardian) => <article key={guardian.id}>
          <div className="guardian-identity"><i><PortalIcon name="students" size={32}/></i><div><h4>{guardian.guardian_name}</h4><p>{guardian.relationship || 'Relationship not provided'}{guardian.is_primary ? ' • Primary Guardian' : ''}</p><strong><PortalIcon name="phone" size={20}/>{guardian.phone_number || 'Phone not recorded'}</strong></div></div>
          <div className="guardian-contact-actions"><a className="guardian-call" href={`tel:${guardian.phone_number}`} aria-label={`Call Guardian ${guardian.guardian_name}`}><PortalIcon name="phone" size={20}/>Call Guardian</a><a href={`sms:${guardian.phone_number}`} aria-label={`Message Guardian ${guardian.guardian_name}`}><PortalIcon name="messages" size={20}/>Message Guardian</a></div>
        </article>)}
      </div>
      <form className="student-form guardian-contact-form" onSubmit={submit}>
        <header className="guardian-section-heading"><i><PortalIcon name="registrations" size={24}/></i><div><h4>Log Contact Attempt</h4><p>Record your communication with the guardian.</p></div></header>
        <div className="student-form-grid">
          <label>Guardian Contact<select value={form.guardianId} onChange={(event) => setForm({ ...form, guardianId: event.target.value })} required>{guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.guardian_name}</option>)}</select></label>
          <label>Contact Method<span className="guardian-select-icon"><PortalIcon name={form.method === 'SMS' ? 'messages' : form.method === 'CALL' ? 'phone' : 'user'}/><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{CONTACT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
          <label>Outcome<span className="guardian-select-icon"><PortalIcon name="check"/><select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}>{CONTACT_OUTCOMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
          <label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength="1000" placeholder="Optional factual Guardian Contact note" /></label>
        </div>
        <button type="submit" disabled={saving || !form.guardianId}><PortalIcon name="registrations" size={20}/>{saving ? 'Saving…' : 'Record Guardian Contact Attempt'}</button>
      </form>
      <section className="guardian-contact-history" aria-label="Guardian Contact History">
        <header className="guardian-section-heading"><i><PortalIcon name="history" size={24}/></i><h4>Guardian Contact History</h4><span>{contacts.length} record{contacts.length === 1 ? '' : 's'}</span></header>
        {contacts.length === 0 ? <p className="empty-state">No Guardian Contact attempts recorded yet.</p> : contacts.slice(0, historyLimit).map((contact) => <article key={contact.id} className={`guardian-history-card guardian-outcome-${String(contact.outcome).toLowerCase()}`}>
          <i><PortalIcon name={contact.contact_method === 'SMS' ? 'messages' : contact.contact_method === 'CALL' ? 'phone' : 'user'} size={22}/></i><div><header><h4>{contactLabel(contact.contact_method)} • <span>{contactLabel(contact.outcome)}</span></h4><span className="guardian-office-badge">{String(contact.contacted_by_role || '').replaceAll('_', ' ')}</span></header><p>{formatManilaDateTime(contact.created_at)}</p>
          <p>{contact.notes || 'No notes recorded.'}</p><small><PortalIcon name="user" size={15}/>{[contact.contacted_by_first_name, contact.contacted_by_last_name].filter(Boolean).join(' ')}{contact.department_name ? ` · ${contact.department_name}` : ''}</small></div>
        </article>)}
        {contacts.length > historyLimit && <button type="button" className="guardian-show-more" onClick={() => setHistoryLimit((current) => current + 5)}>Show more ({contacts.length - historyLimit} remaining)</button>}
      </section>
    </>}
    <aside className="guardian-privacy-note"><PortalIcon name="lock" size={24}/><p>Guardian contact information is private. Use it only for authorized student support and discipline follow-up.</p></aside>
  </section>
}

export default GuardianContactPanel
