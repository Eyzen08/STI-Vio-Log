import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatDuration, formatManilaDate } from '../lib/displayFormat.js'
import { formatProgramName } from '../lib/programNames.js'
import { readableOfficerName, readSignatureFile } from '../lib/signatureImage.js'
import Modal from './Modal.jsx'

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
  const [studentSearch, setStudentSearch] = useState('')
  const [studentStatus, setStudentStatus] = useState('ALL')
  const [signatures, setSignatures] = useState([])
  const [certificates, setCertificates] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedSignatures, setSelectedSignatures] = useState([])
  const [draft, setDraft] = useState({ student_name: '', program: '' })
  const [signatureForm, setSignatureForm] = useState({ full_name: '', position: 'Discipline Officer', image_data_url: '' })
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', position: '', image_data_url: '' })
  const [editErrors, setEditErrors] = useState({})
  const [deactivating, setDeactivating] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [approving, setApproving] = useState(null)
  const [approveError, setApproveError] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [eligible, officers, issued] = await Promise.all([
        jsonRequest('/api/clearance/certificates/students', token), jsonRequest('/api/clearance/signatures', token), jsonRequest('/api/clearance/certificates', token)
      ])
      setStudents(eligible.students || []); setSignatures(officers.signatures || []); setCertificates(issued.certificates || [])
    } catch (requestError) { setError(requestError.message) }
  }, [token])
  useEffect(() => { load() }, [load])

  const qualifiedStudents = useMemo(() => students.filter((student) => student.certificate_eligible), [students])
  const visibleStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    return students.filter((student) => (studentStatus === 'ALL' || student.qualification_status === studentStatus)
      && (!query || [student.student_name, student.student_number, student.program].some((value) => String(value || '').toLowerCase().includes(query))))
  }, [students, studentSearch, studentStatus])

  const chooseStudent = (student) => {
    setSelected(student); setDraft({ student_name: student.student_name, program: student.program || '' }); setSelectedSignatures([]); setError(''); setMessage('')
  }
  const readSignature = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { const image = await readSignatureFile(file); setSignatureForm((value) => ({ ...value, image_data_url: image })); setError('') }
    catch (imageError) { setError(imageError.message); event.target.value = '' }
  }
  const saveSignature = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { await jsonRequest('/api/clearance/signatures', token, { method: 'POST', body: JSON.stringify(signatureForm) }); setSignatureForm({ full_name: '', position: 'Discipline Officer', image_data_url: '' }); setMessage('Officer signature saved.'); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const toggleSignature = async (entry) => {
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/signatures/${entry.id}`, token, { method: 'PUT', body: JSON.stringify({ is_active: !entry.is_active }) }); setDeactivating(null); setMessage(`${readableOfficerName(entry.full_name)}'s signature ${entry.is_active ? 'deactivated' : 'activated'}.`); await load() }
    catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const editSignature = (entry) => {
    setEditing(entry); setEditForm({ full_name: entry.full_name, position: entry.position, image_data_url: '' }); setEditErrors({}); setError('')
  }
  const saveSignatureEdit = async (event) => {
    event.preventDefault(); if (busy) return
    const nextErrors = { full_name: editForm.full_name.trim() ? '' : 'Officer full name is required.', position: editForm.position.trim() ? '' : 'Position or role is required.' }
    setEditErrors(nextErrors)
    if (nextErrors.full_name || nextErrors.position) return
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/signatures/${editing.id}`, token, { method: 'PUT', body: JSON.stringify(editForm) }); setEditing(null); setMessage(editForm.image_data_url ? 'E-signature details and image updated.' : 'E-signature details updated.'); await load() }
    catch (requestError) { setEditErrors({ form: requestError.message }) } finally { setBusy(false) }
  }
  const readEditSignature = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { const image = await readSignatureFile(file); setEditForm((value) => ({ ...value, image_data_url: image })); setEditErrors((value) => ({ ...value, image: '' })) }
    catch (imageError) { setEditErrors((value) => ({ ...value, image: imageError.message })); event.target.value = '' }
  }
  const issue = async () => {
    if (!selected || !selectedSignatures.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await jsonRequest('/api/clearance/certificates', token, { method: 'POST', body: JSON.stringify({ student_id: selected.id, ...draft, signature_ids: selectedSignatures }) })
      setMessage(`Certificate ${data.certificate.certificate_number} issued. Email: ${data.certificate.email_status}.`); setSelected(null); await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  const revoke = async () => {
    const reason = revokeReason.trim()
    if (!reason || busy || !revoking) return
    const entry = revoking
    setRevokeError('')
    setBusy(true); setError('')
    try { await jsonRequest(`/api/clearance/certificates/${entry.id}/revoke`, token, { method: 'POST', body: JSON.stringify({ reason }) }); setRevoking(null); setRevokeReason(''); setMessage('Certificate revoked. A corrected version may now be issued.'); await load() }
    catch (requestError) { setRevokeError(requestError.message) } finally { setBusy(false) }
  }
  const approveClearance = async () => {
    if (!approving?.clearance_id || busy) return
    setBusy(true); setError(''); setApproveError(''); setMessage('')
    try {
      await jsonRequest(`/api/clearance/${approving.clearance_id}/approve`, token, { method: 'PUT', body: '{}' })
      setApproving(null); setMessage(`${approving.student_name} is now qualified for certificate issuance.`); await load()
    } catch (requestError) { setApproveError(requestError.message) } finally { setBusy(false) }
  }

  return <section className="certificate-admin" aria-labelledby="certificate-management-title">
    <header className="management-page-header"><div><span className="page-breadcrumb">Home / Clearance</span><h2 id="certificate-management-title">Clearance Management</h2><p>Review validated eligibility, issue verifiable certificates, and manage authorized e-signatures.</p></div><span className="readonly-badge">Authorized staff only</span></header>
    <section className="management-metrics" aria-label="Clearance certificate summary">
      <article className="management-metric metric-green"><i>◎</i><div><strong>{qualifiedStudents.length}</strong><span>Qualified Students</span></div></article>
      <article className="management-metric metric-blue"><i>◇</i><div><strong>{certificates.filter((entry) => entry.status === 'ISSUED').length}</strong><span>Issued Certificates</span></div></article>
      <article className="management-metric metric-red"><i>!</i><div><strong>{certificates.filter((entry) => entry.status === 'REVOKED').length}</strong><span>Revoked Certificates</span></div></article>
      <article className="management-metric metric-orange"><i>✓</i><div><strong>{signatures.filter((entry) => entry.is_active).length}</strong><span>Active Signatures</span></div></article>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    <div className="certificate-grid">
      <section className="table-card"><div className="table-header"><h3>Student clearance status</h3><span>{visibleStudents.length} of {students.length} students</span></div>
        <div className="clearance-directory-filters"><label><span className="sr-only">Search students</span><input type="search" placeholder="Search by name, student number, or program…" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} /></label><label><span className="sr-only">Filter by clearance status</span><select value={studentStatus} onChange={(event) => setStudentStatus(event.target.value)}><option value="ALL">All statuses</option><option value="QUALIFIED">Qualified</option><option value="AWAITING_CLEARANCE">Awaiting clearance</option><option value="NEEDS_SERVICE">Needs service hours</option><option value="BLOCKED">Blocked</option><option value="NO_SERVICE_REQUIRED">No service assignment</option></select></label></div>
        <div className="clearance-status-legend"><span><b>{qualifiedStudents.length}</b> qualified</span><span><b>{students.filter((student) => student.qualification_status === 'NEEDS_SERVICE').length}</b> need hours</span><span><b>{students.filter((student) => student.qualification_status === 'AWAITING_CLEARANCE').length}</b> awaiting approval</span></div>
        <div className="certificate-student-list">{visibleStudents.length ? visibleStudents.map((student) => <button type="button" key={student.id} disabled={(student.qualification_status !== 'AWAITING_CLEARANCE' && !student.certificate_eligible) || student.has_issued_certificate || (student.qualification_status === 'AWAITING_CLEARANCE' && !student.clearance_id)} className={selected?.id === student.id ? 'selected' : ''} onClick={() => { if (student.qualification_status === 'AWAITING_CLEARANCE') { setApproveError(''); setApproving(student) } else chooseStudent(student) }}>
          <span className={`clearance-directory-status status-${student.qualification_status.toLowerCase().replaceAll('_', '-')}`}>{student.qualification_status.replaceAll('_', ' ')}</span><strong>{student.student_name}</strong><span>{student.student_number} • {student.program || 'Program not recorded'}</span><small>{student.assignment_count ? `${formatDuration(student.completed_hours)} of ${formatDuration(student.required_hours)} completed` : 'No assigned community service hours'} • {student.qualification_reason}</small>
          {student.qualification_status === 'AWAITING_CLEARANCE' && student.clearance_id && <em>Click to approve clearance</em>}
        </button>) : <p className="empty-state">No students match this search and status filter.</p>}</div>
      </section>
      {selected && <Modal title={`Review clearance — ${selected.student_number}`} drawer onClose={() => setSelected(null)}><section className="certificate-review"><div className="table-header"><h3>Review and issue</h3><span>Draft preview</span></div>
        <>
          <div className="student-form-grid"><label>Certificate name<input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} /></label><label>Program or course<input value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })} /></label></div>
          <div className="certificate-preview"><p>STI COLLEGE - GLOBAL CITY</p><h3>CERTIFICATE OF COMPLIANCE</h3><p>This is to certify that</p><strong>{draft.student_name}</strong><p>is enrolled under the <b>{formatProgramName(draft.program)}</b> and has successfully completed community service for <b>{formatDuration(selected.completed_hours)}</b>.</p><small>Issued on {formatManilaDate(new Date())}</small></div>
          <fieldset className="signature-picker"><legend>Authorized signatures</legend>{signatures.filter((entry) => entry.is_active).map((entry) => <label key={entry.id}><input type="checkbox" checked={selectedSignatures.includes(Number(entry.id))} onChange={(e) => setSelectedSignatures((value) => e.target.checked ? [...value, Number(entry.id)].slice(0, 3) : value.filter((id) => id !== Number(entry.id)))} /><img src={entry.image_data_url} alt="" /><span>{entry.full_name}<small>{entry.position}</small></span></label>)}</fieldset>
          <button className="submit-btn" type="button" disabled={busy || !draft.student_name.trim() || !draft.program.trim() || !selectedSignatures.length} onClick={issue}>{busy ? 'Issuing Certificate…' : 'Issue, Email & Prepare PDF'}</button>
        </>
      </section></Modal>}
    </div>
    <section className="table-card signature-management"><div className="table-header"><h3>E-Signature Management</h3><span>PNG/JPEG • max 1 MB</span></div>
      <form onSubmit={saveSignature} className="signature-form"><label>Officer full name<input required value={signatureForm.full_name} onChange={(e) => setSignatureForm({ ...signatureForm, full_name: e.target.value })} /></label><label>Position<input required value={signatureForm.position} onChange={(e) => setSignatureForm({ ...signatureForm, position: e.target.value })} /></label><label>Signature image<input required={!signatureForm.image_data_url} type="file" accept="image/png,image/jpeg" onChange={readSignature} /></label>{signatureForm.image_data_url && <img src={signatureForm.image_data_url} alt="Signature preview" />}<button disabled={busy} className="submit-btn">Save signature</button></form>
      <div className="signature-directory">{signatures.map((entry) => <article key={entry.id}><div className="signature-card-heading"><span className={`status-badge ${entry.is_active ? 'status-completed' : 'status-inactive'}`}>{entry.is_active ? 'Active' : 'Inactive'}</span><small>Updated {formatManilaDate(entry.updated_at)}</small></div><img src={entry.image_data_url} alt={`Signature of ${readableOfficerName(entry.full_name)}`} /><strong>{readableOfficerName(entry.full_name)}</strong><span>{entry.position}</span><div className="inline-actions"><button type="button" disabled={busy} onClick={() => editSignature(entry)}>Edit</button><button className={entry.is_active ? 'danger-button' : ''} type="button" disabled={busy} onClick={() => entry.is_active ? setDeactivating(entry) : toggleSignature(entry)}>{entry.is_active ? 'Deactivate' : 'Activate'}</button></div></article>)}</div>
    </section>
    <section className="table-card"><div className="table-header"><h3>Issued certificate history</h3><span>{certificates.length} records</span></div>{certificates.length ? <div className="table-wrap"><table className="management-record-table"><thead><tr><th>Certificate</th><th>Student</th><th>Completed service</th><th>Status</th><th>Email</th><th>Actions</th></tr></thead><tbody>{certificates.map((entry) => <tr key={entry.id}><td data-label="Certificate">{entry.certificate_number}<br/><small>Version {entry.version}</small></td><td data-label="Student">{entry.student_name}<br/><small>{entry.student_number}</small></td><td data-label="Completed service">{formatDuration(entry.completed_hours)}</td><td data-label="Status"><span className="status-badge">{entry.status}</span></td><td data-label="Email">{entry.email_status}</td><td data-label="Actions"><div className="inline-actions"><button type="button" onClick={() => downloadPdf(`/api/clearance/certificates/${entry.id}/pdf`, token, `${entry.certificate_number}.pdf`)}>Download</button>{entry.status === 'ISSUED' && <><button type="button" onClick={() => jsonRequest(`/api/clearance/certificates/${entry.id}/email`, token, { method: 'POST', body: '{}' }).then(load).catch((e) => setError(e.message))}>Email</button><button className="danger-button" type="button" onClick={() => { setRevoking(entry); setRevokeReason(''); setRevokeError('') }}>Revoke</button></>}</div></td></tr>)}</tbody></table></div> : <p className="empty-state">No clearance certificates have been issued.</p>}</section>
    {editing && <Modal title="Edit E-Signature" dirty={editForm.full_name !== editing.full_name || editForm.position !== editing.position || Boolean(editForm.image_data_url)} onClose={() => !busy && setEditing(null)}><form className="signature-edit-form" onSubmit={saveSignatureEdit} noValidate><p className="modal-help">Update the officer details and optionally replace the current signature image.</p>{editErrors.form && <p className="error-message" role="alert">{editErrors.form}</p>}<label>Officer Full Name<input value={editForm.full_name} aria-invalid={Boolean(editErrors.full_name)} onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })} />{editErrors.full_name && <small className="field-error">{editErrors.full_name}</small>}</label><label>Position/Role<input value={editForm.position} aria-invalid={Boolean(editErrors.position)} onChange={(event) => setEditForm({ ...editForm, position: event.target.value })} />{editErrors.position && <small className="field-error">{editErrors.position}</small>}</label><div className="signature-preview-grid"><figure><figcaption>Current signature</figcaption><img src={editing.image_data_url} alt={`Current signature of ${readableOfficerName(editing.full_name)}`} /></figure><figure><figcaption>Replacement preview</figcaption>{editForm.image_data_url ? <img src={editForm.image_data_url} alt="Replacement signature preview" /> : <span>Current image will be kept</span>}</figure></div><label>Signature Image <small>Optional · PNG/JPEG · max 1 MB</small><input type="file" accept="image/png,image/jpeg" onChange={readEditSignature} />{editErrors.image && <small className="field-error">{editErrors.image}</small>}</label><footer className="modal-actions"><button type="button" disabled={busy} data-modal-dismiss>Cancel</button><button className="submit-btn" disabled={busy}>{busy ? 'Saving changes…' : 'Save Changes'}</button></footer></form></Modal>}
    {deactivating && <Modal title="Deactivate E-Signature" onClose={() => !busy && setDeactivating(null)}><div className="confirmation-dialog"><p>Deactivate the signature for <strong>{readableOfficerName(deactivating.full_name)}</strong>?</p><p>It will remain on certificates that have already been issued.</p><footer className="modal-actions"><button type="button" disabled={busy} onClick={() => setDeactivating(null)}>Cancel</button><button className="danger-button" type="button" disabled={busy} onClick={() => toggleSignature(deactivating)}>{busy ? 'Deactivating…' : 'Deactivate'}</button></footer></div></Modal>}
    {approving && <Modal title="Approve student clearance" onClose={() => !busy && setApproving(null)}><div className="confirmation-dialog"><p>Approve clearance for <strong>{approving.student_name}</strong> ({approving.student_number})?</p><p>The system will verify again that there are no open violations or incomplete community service hours. After approval, the student can receive a clearance certificate.</p>{approveError && <p className="error-message" role="alert">{approveError}</p>}<footer className="modal-actions"><button type="button" disabled={busy} onClick={() => setApproving(null)}>Cancel</button><button className="submit-btn" type="button" disabled={busy} onClick={approveClearance}>{busy ? 'Approving…' : 'Approve Clearance'}</button></footer></div></Modal>}
    {revoking && <Modal title="Revoke certificate" dirty={Boolean(revokeReason.trim())} onClose={() => !busy && setRevoking(null)}><form className="confirmation-dialog" onSubmit={(event) => { event.preventDefault(); revoke() }}><p>Revoke <strong>{revoking.certificate_number}</strong> for <strong>{revoking.student_name}</strong>? The certificate history and your reason will be retained.</p><label>Reason for revocation<textarea required value={revokeReason} disabled={busy} onChange={(event) => setRevokeReason(event.target.value)} rows={3}/></label>{revokeError && <p role="alert" className="error-message">{revokeError}</p>}<footer className="modal-actions"><button type="button" data-modal-dismiss disabled={busy}>Cancel</button><button type="submit" className="danger-button" disabled={busy || !revokeReason.trim()}>{busy ? 'Revoking…' : 'Revoke certificate'}</button></footer></form></Modal>}
  </section>
}

export default AdminClearanceCertificates
