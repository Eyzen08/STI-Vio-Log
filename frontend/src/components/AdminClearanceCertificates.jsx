import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'

const jsonRequest = async (path, token, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Request failed')
  return data
}

const downloadPdf = async (path, token, filename) => {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Certificate download failed')
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

function AdminClearanceCertificates({ token }) {
  const [students, setStudents] = useState([])
  const [signatures, setSignatures] = useState([])
  const [certificates, setCertificates] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedSignatures, setSelectedSignatures] = useState([])
  const [draft, setDraft] = useState({ student_name: '', program: '' })
  const [signatureForm, setSignatureForm] = useState({ full_name: '', position: 'Discipline Officer', image_data_url: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [eligible, officers, issued] = await Promise.all([
        jsonRequest('/api/clearance/certificates/eligible', token), jsonRequest('/api/clearance/signatures', token), jsonRequest('/api/clearance/certificates', token)
      ])
      setStudents(eligible.students || []); setSignatures(officers.signatures || []); setCertificates(issued.certificates || [])
    } catch (requestError) { setError(requestError.message) }
  }, [token])
  useEffect(() => { load() }, [load])

  const chooseStudent = (student) => {
    setSelected(student); setDraft({ student_name: student.student_name, program: student.program || '' }); setSelectedSignatures([]); setError(''); setMessage('')
  }
  const readSignature = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) { setError('Use a PNG or JPEG signature no larger than 1 MB.'); return }
    const reader = new FileReader(); reader.onload = () => setSignatureForm((value) => ({ ...value, image_data_url: reader.result })); reader.readAsDataURL(file)
  }
  const saveSignature = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { await jsonRequest('/api/clearance/signatures', token, { method: 'POST', body: JSON.stringify(signatureForm) }); setSignatureForm({ full_name: '', position: 'Discipline Officer', image_data_url: '' }); setMessage('Officer signature saved.'); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const toggleSignature = async (entry) => {
    if (entry.is_active && !window.confirm(`Deactivate the signature for ${entry.full_name}? It will remain on already-issued certificates.`)) return
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/signatures/${entry.id}`, token, { method: 'PUT', body: JSON.stringify({ is_active: !entry.is_active }) }); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const editSignature = async (entry) => {
    const fullName = window.prompt('Officer full name:', entry.full_name)
    if (!fullName?.trim()) return
    const position = window.prompt('Officer position:', entry.position)
    if (!position?.trim()) return
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/signatures/${entry.id}`, token, { method: 'PUT', body: JSON.stringify({ full_name: fullName, position }) }); setMessage('Officer signature details updated.'); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const issue = async () => {
    if (!selected || !selectedSignatures.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await jsonRequest('/api/clearance/certificates', token, { method: 'POST', body: JSON.stringify({ student_id: selected.id, ...draft, signature_ids: selectedSignatures }) })
      setMessage(`Certificate ${data.certificate.certificate_number} issued. Email: ${data.certificate.email_status}.`); setSelected(null); await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const revoke = async (entry) => {
    const reason = window.prompt(`Reason for revoking ${entry.certificate_number}:`)
    if (!reason?.trim()) return
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/certificates/${entry.id}/revoke`, token, { method: 'POST', body: JSON.stringify({ reason }) }); setMessage('Certificate revoked. A corrected version may now be issued.'); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  return <section className="certificate-admin" aria-labelledby="certificate-management-title">
    <div className="table-card certificate-hero"><div><p className="eyebrow">Official records</p><h2 id="certificate-management-title">Clearance certificates</h2><p>Issue permanent, verifiable Certificates of Compliance only after all requirements are complete.</p></div><span>Authorized staff only</span></div>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    <div className="certificate-grid">
      <section className="table-card"><div className="table-header"><h3>Eligible students</h3><span>{students.length} ready</span></div>
        <div className="certificate-student-list">{students.length ? students.map((student) => <button type="button" key={student.id} className={selected?.id === student.id ? 'selected' : ''} onClick={() => chooseStudent(student)}>
          <strong>{student.student_name}</strong><span>{student.student_number} • {student.program || 'Program not recorded'}</span><small>{student.completed_hours} of {student.required_hours} hours completed{student.has_issued_certificate ? ' • Certificate issued' : ''}</small>
        </button>) : <p className="empty-state">No students currently satisfy every certificate requirement.</p>}</div>
      </section>
      <section className="table-card certificate-review"><div className="table-header"><h3>Review and issue</h3><span>{selected ? 'Draft preview' : 'Select a student'}</span></div>
        {!selected ? <p className="empty-state">Select an eligible student to prepare a certificate. Review fields affect this certificate only.</p> : <>
          <div className="student-form-grid"><label>Certificate name<input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} /></label><label>Program or course<input value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })} /></label></div>
          <div className="certificate-preview"><p>STI COLLEGE - GLOBAL CITY</p><h3>CERTIFICATE OF COMPLIANCE</h3><p>This is to certify that</p><strong>{draft.student_name}</strong><p>is enrolled under the <b>{draft.program}</b> and has successfully completed community service for <b>{selected.completed_hours} hours</b>.</p><small>Issued on {new Date().toLocaleDateString()}</small></div>
          <fieldset className="signature-picker"><legend>Authorized signatures</legend>{signatures.filter((entry) => entry.is_active).map((entry) => <label key={entry.id}><input type="checkbox" checked={selectedSignatures.includes(Number(entry.id))} onChange={(e) => setSelectedSignatures((value) => e.target.checked ? [...value, Number(entry.id)].slice(0, 3) : value.filter((id) => id !== Number(entry.id)))} /><img src={entry.image_data_url} alt="" /><span>{entry.full_name}<small>{entry.position}</small></span></label>)}</fieldset>
          <button className="submit-btn" type="button" disabled={busy || !draft.student_name.trim() || !draft.program.trim() || !selectedSignatures.length} onClick={issue}>{busy ? 'Issuing Certificate…' : 'Issue, Email & Prepare PDF'}</button>
        </>}
      </section>
    </div>
    <section className="table-card signature-management"><div className="table-header"><h3>E-Signature Management</h3><span>PNG/JPEG • max 1 MB</span></div>
      <form onSubmit={saveSignature} className="signature-form"><label>Officer full name<input required value={signatureForm.full_name} onChange={(e) => setSignatureForm({ ...signatureForm, full_name: e.target.value })} /></label><label>Position<input required value={signatureForm.position} onChange={(e) => setSignatureForm({ ...signatureForm, position: e.target.value })} /></label><label>Signature image<input required={!signatureForm.image_data_url} type="file" accept="image/png,image/jpeg" onChange={readSignature} /></label>{signatureForm.image_data_url && <img src={signatureForm.image_data_url} alt="Signature preview" />}<button disabled={busy} className="submit-btn">Save signature</button></form>
      <div className="signature-directory">{signatures.map((entry) => <article key={entry.id}><img src={entry.image_data_url} alt={`Signature of ${entry.full_name}`} /><strong>{entry.full_name}</strong><span>{entry.position}</span><div className="inline-actions"><button type="button" disabled={busy} onClick={() => editSignature(entry)}>Edit</button><button type="button" disabled={busy} onClick={() => toggleSignature(entry)}>{entry.is_active ? 'Deactivate' : 'Activate'}</button></div></article>)}</div>
    </section>
    <section className="table-card"><div className="table-header"><h3>Issued certificate history</h3><span>{certificates.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Certificate</th><th>Student</th><th>Hours</th><th>Status</th><th>Email</th><th>Actions</th></tr></thead><tbody>{certificates.map((entry) => <tr key={entry.id}><td>{entry.certificate_number}<br/><small>Version {entry.version}</small></td><td>{entry.student_name}<br/><small>{entry.student_number}</small></td><td>{entry.completed_hours}</td><td><span className="status-badge">{entry.status}</span></td><td>{entry.email_status}</td><td><div className="inline-actions"><button type="button" onClick={() => downloadPdf(`/api/clearance/certificates/${entry.id}/pdf`, token, `${entry.certificate_number}.pdf`)}>Download</button>{entry.status === 'ISSUED' && <><button type="button" onClick={() => jsonRequest(`/api/clearance/certificates/${entry.id}/email`, token, { method: 'POST', body: '{}' }).then(load).catch((e) => setError(e.message))}>Email</button><button className="danger-button" type="button" onClick={() => revoke(entry)}>Revoke</button></>}</div></td></tr>)}</tbody></table></div></section>
  </section>
}

export default AdminClearanceCertificates
