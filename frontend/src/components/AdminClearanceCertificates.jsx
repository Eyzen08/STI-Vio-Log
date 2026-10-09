import { academicProgram, isSeniorHigh } from '../lib/studentAcademic.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notificationTarget } from '../lib/studentNotifications.js'
import RecordTargetFocus from './RecordTargetFocus.jsx'
import { API_URL } from '../lib/api.js'
import { formatDisplayLabel, formatDuration, formatManilaDate } from '../lib/displayFormat.js'
import { formatProgramName } from '../lib/programNames.js'
import ProgramSelect from './ProgramSelect.jsx'
import { readableOfficerName, readSignatureFile } from '../lib/signatureImage.js'
import Modal from './Modal.jsx'
import ManagementMetric from './ManagementMetric.jsx'
import { clearanceStatusLabel, filterClearanceStudents } from '../lib/clearanceDirectory.js'
import '../styles/clearance-management.css'

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

const clearancePanels = [
  { id: 'students', label: 'Student Clearance Status' },
  { id: 'signatures', label: 'E-Signature Management' },
  { id: 'history', label: 'Certificate History' }
]
const clearancePanelIds = new Set(clearancePanels.map(({ id }) => id))
const clearancePanelFromLocation = () => {
  const requested = new URLSearchParams(window.location.search).get('panel')
  return clearancePanelIds.has(requested) ? requested : 'students'
}

function AdminClearanceCertificates({ token, awaitingOnly = false, onNavigate, searchParams = '' }) {
  const target = notificationTarget(searchParams)
  const [targetClearance, setTargetClearance] = useState(null)
  const [targetLoading, setTargetLoading] = useState(Boolean(target.clearanceId))
  const [targetError, setTargetError] = useState(false)
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
  const [approvalTerm, setApprovalTerm] = useState({ academic_year: '', semester: '1st Semester' })
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState(clearancePanelFromLocation)
  const tabRefs = useRef([])
  const studentSearchRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eligible, officers, issued] = await Promise.all([
        jsonRequest('/api/clearance/certificates/students', token),
        awaitingOnly ? Promise.resolve({}) : jsonRequest('/api/clearance/signatures', token),
        awaitingOnly ? Promise.resolve({}) : jsonRequest('/api/clearance/certificates', token)
      ])
      const uniqueStudents = [...new Map((eligible.students || []).map((student) => [String(student.id), student])).values()]
      setStudents(uniqueStudents); setSignatures(officers.signatures || []); setCertificates(issued.certificates || [])
    } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }, [token, awaitingOnly])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (target.invalid || !target.clearanceId) return
    const controller = new AbortController()
    fetch(`${API_URL}/api/clearance/${target.clearanceId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || !data.clearanceRecord) throw new Error('Clearance unavailable')
        if (!controller.signal.aborted) setTargetClearance(data.clearanceRecord)
      })
      .catch(() => { if (!controller.signal.aborted) setTargetError(true) })
      .finally(() => { if (!controller.signal.aborted) setTargetLoading(false) })
    return () => controller.abort()
  }, [target.invalid, target.clearanceId, token])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (awaitingOnly) return
    if (url.searchParams.get('panel') !== activePanel) {
      url.searchParams.set('panel', activePanel)
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [activePanel, awaitingOnly])
  useEffect(() => {
    const handlePopState = () => setActivePanel(clearancePanelFromLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const qualifiedStudents = useMemo(() => students.filter((student) => student.certificate_eligible), [students])
  const awaitingStudents = useMemo(() => students.filter((student) => student.qualification_status === 'AWAITING_CLEARANCE'), [students])
  const visibleStudents = useMemo(() => filterClearanceStudents(students, studentSearch, awaitingOnly ? 'AWAITING_CLEARANCE' : studentStatus), [students, studentSearch, studentStatus, awaitingOnly])

  const chooseStudent = (student) => {
    setSelected(student); setDraft({ student_name: student.student_name, program: (isSeniorHigh(student) ? student.strand : student.program) || '' }); setSelectedSignatures([]); setError(''); setMessage('')
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
    if (!approving || busy) return
    setBusy(true); setError(''); setApproveError(''); setMessage('')
    try {
      const body = approving.clearance_id ? {} : approvalTerm
      await jsonRequest(`/api/clearance/certificates/students/${approving.id}/approve`, token, { method: 'POST', body: JSON.stringify(body) })
      setApproving(null); setMessage(`${approving.student_name} is now qualified for certificate issuance.`); await load()
      studentSearchRef.current?.focus()
    } catch (requestError) { setApproveError(requestError.message) } finally { setBusy(false) }
  }
  const selectPanel = (nextPanel) => {
    if (!clearancePanelIds.has(nextPanel) || nextPanel === activePanel) return
    setActivePanel(nextPanel)
    const url = new URL(window.location.href)
    url.searchParams.set('panel', nextPanel)
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
  const handleTabKeyDown = (event, index) => {
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % clearancePanels.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + clearancePanels.length) % clearancePanels.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = clearancePanels.length - 1
    else return
    event.preventDefault()
    tabRefs.current[nextIndex]?.focus()
    selectPanel(clearancePanels[nextIndex].id)
  }

  return <section className="certificate-admin" aria-labelledby="certificate-management-title">
    <RecordTargetFocus id={target.invalid ? null : target.certificateId ? `certificate-record-${target.certificateId}` : target.clearanceId ? `clearance-record-${target.clearanceId}` : null} loading={loading || targetLoading} error={error || targetError} />
    {targetClearance && <section className="table-card" id={`clearance-record-${targetClearance.id}`} tabIndex={-1}>
      <h3>Clearance record #{targetClearance.id}</h3>
      <p>{targetClearance.first_name} {targetClearance.last_name} · {targetClearance.student_number}</p>
      <dl>{[['Academic year', targetClearance.academic_year], ['Semester', targetClearance.semester], ['Status', formatDisplayLabel(targetClearance.status)], ['Approved', formatManilaDate(targetClearance.cleared_at, '—')], ['Remarks', targetClearance.remarks || '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>}
    <header className="management-page-header portal-page-header"><div><span className="page-breadcrumb">Home / Clearance{awaitingOnly ? ' / Awaiting Clearance' : ''}</span><h2 id="certificate-management-title">{awaitingOnly ? 'Awaiting Clearance' : 'Clearance Management'}</h2><p>{awaitingOnly ? 'These students have completed community service and have no unresolved violations. Review and approve their clearance.' : 'Check service progress, approve completed service, then issue a certificate.'}</p></div><button type="button" className="clearance-workspace-link" onClick={() => onNavigate(awaitingOnly ? '/admin/clearance' : '/admin/awaiting-clearance')}>{awaitingOnly ? 'Back to Clearance Management' : `Awaiting Clearance (${awaitingStudents.length})`}</button></header>
    {!awaitingOnly && <section className="management-metrics" aria-label="Clearance certificate summary">
      <ManagementMetric tone="orange" icon="clock" value={awaitingStudents.length} label="Awaiting Clearance"/>
      <ManagementMetric tone="green" icon="students" value={qualifiedStudents.filter((student) => !student.has_issued_certificate).length} label="Ready for Certificate"/>
      <ManagementMetric icon="clearance" value={certificates.filter((entry) => entry.status === 'ISSUED').length} label="Issued Certificates"/>
      <ManagementMetric tone="red" icon="service" value={students.filter((student) => student.qualification_status === 'NEEDS_SERVICE').length} label="Needs Service Hours"/>
    </section>}
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    {!awaitingOnly && <nav className="clearance-panel-tabs" role="tablist" aria-label="Clearance management sections">{clearancePanels.map((panel, index) => <button type="button" role="tab" id={`clearance-tab-${panel.id}`} aria-controls={`clearance-panel-${panel.id}`} aria-selected={activePanel === panel.id} tabIndex={activePanel === panel.id ? 0 : -1} ref={(node) => { tabRefs.current[index] = node }} onClick={() => selectPanel(panel.id)} onKeyDown={(event) => handleTabKeyDown(event, index)} key={panel.id}><b>{panel.label}</b></button>)}</nav>}
    <div className="clearance-panel-workspace">
    {(awaitingOnly || activePanel === 'students') && <section className="clearance-panel" role={awaitingOnly ? 'region' : 'tabpanel'} id="clearance-panel-students" aria-labelledby={awaitingOnly ? 'clearance-directory-title' : 'clearance-tab-students'} data-panel="students">
    <div className="certificate-grid">
      <section className="table-card"><div className="table-header"><div><h3 id="clearance-directory-title">{awaitingOnly ? 'Completed service · awaiting approval' : 'Student clearance status'}</h3><p className="clearance-section-help">{awaitingOnly ? 'Approve clearance here. Certificates can be issued from Clearance Management after approval.' : 'Service completed → Clearance approved → Certificate issued'}</p></div><span>{loading ? 'Loading students…' : `${visibleStudents.length} of ${awaitingOnly ? awaitingStudents.length : students.length} students`}</span></div>
        <div className={`clearance-directory-filters${awaitingOnly ? ' clearance-directory-filters--queue' : ''}`}><label>Search students<input ref={studentSearchRef} type="search" name="clearance-student-filter" autoComplete="off" placeholder="Name, student number, program or strand" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} /></label>{!awaitingOnly && <label>Clearance status<select value={studentStatus} onChange={(event) => setStudentStatus(event.target.value)}><option value="ALL">All statuses</option><option value="QUALIFIED">Approved clearance</option><option value="AWAITING_CLEARANCE">Awaiting clearance</option><option value="NEEDS_SERVICE">Needs service hours</option><option value="BLOCKED">Blocked by violation</option><option value="NO_SERVICE_REQUIRED">No service assigned</option></select></label>}</div>
        <div className="clearance-record-heading" aria-hidden="true"><span>Student</span><span>Community service</span><span>Clearance status</span><span>Next step</span></div>
        <div className="certificate-student-list" aria-busy={loading}>{loading ? <p className="empty-state" role="status">Loading clearance records…</p> : error && !students.length ? <div className="empty-state"><p>Clearance records could not be loaded.</p><button type="button" onClick={() => { setError(''); load() }}>Try again</button></div> : visibleStudents.length ? visibleStudents.map((student) => <article key={student.id} className={`certificate-student-card${selected?.id === student.id ? ' selected' : ''}`}>
          <div className="clearance-student-identity"><strong>{student.student_name}</strong><span>{student.student_number}</span><small>{academicProgram(student)}</small></div>
          <div className="clearance-service-progress"><span className="clearance-mobile-label">Community service</span><strong>{student.assignment_count ? `${formatDuration(student.completed_hours)} / ${formatDuration(student.required_hours)}` : 'No service assigned'}</strong>{student.assignment_count > 0 && <progress aria-label={`Community service completed for ${student.student_name}`} max={student.required_hours || 1} value={Math.min(student.completed_hours, student.required_hours)} />}<small>{student.service_complete ? 'Service complete' : student.assignment_count ? 'Service in progress' : 'No hours required'}</small></div>
          <div className="clearance-student-status"><span className="clearance-mobile-label">Clearance status</span><span className={`clearance-directory-status status-${student.qualification_status.toLowerCase().replaceAll('_', '-')}`}>{clearanceStatusLabel(student)}</span><small>{student.qualification_reason}</small></div>
          <div className="clearance-student-action">{student.qualification_status === 'AWAITING_CLEARANCE' ? awaitingOnly ? <button type="button" className="clearance-approve-button" disabled={busy} onClick={() => { setApproveError(''); setApprovalTerm({ academic_year: '', semester: '1st Semester' }); setApproving(student) }}>Approve Clearance</button> : <button type="button" className="clearance-workspace-link" onClick={() => onNavigate('/admin/awaiting-clearance')}>Review approval</button> : student.certificate_eligible && !student.has_issued_certificate ? <button type="button" className="clearance-issue-button" disabled={busy} onClick={() => chooseStudent(student)}>Review &amp; Issue Certificate</button> : student.has_issued_certificate ? <button type='button' className='clearance-workspace-link' onClick={() => selectPanel('history')}>View certificate</button> : <small>{student.qualification_status === 'BLOCKED' ? 'Resolve violation first' : student.qualification_status === 'NEEDS_SERVICE' ? 'Complete service hours' : 'No action required'}</small>}</div>
        </article>) : <div className="empty-state"><strong>{awaitingOnly && !studentSearch.trim() ? 'No students awaiting clearance' : 'No students match your search'}</strong><p>{awaitingOnly && !studentSearch.trim() ? 'Students appear here once service is complete and all violations are resolved.' : 'Try a different name, number or status.'}</p></div>}</div>
      </section>
      {selected && <Modal title={`Review Clearance — ${selected.student_number}`} drawer onClose={() => setSelected(null)}><section className="certificate-review"><div className="table-header"><h3>Review and Issue</h3><span>Draft preview</span></div>
        <>
          <div className="student-form-grid"><label>Certificate name<input value={draft.student_name} onChange={(e) => setDraft({ ...draft, student_name: e.target.value })} /></label><label>{isSeniorHigh(selected)?'Strand':'Program or course'}{isSeniorHigh(selected)?<select value={draft.program} onChange={e=>setDraft({...draft,program:e.target.value})} required><option value="">Select strand</option><option value="ABM">ABM</option><option value="STEM">STEM</option></select>:<ProgramSelect value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })} required />}</label></div>
          <div className="certificate-preview"><p>STI COLLEGE - GLOBAL CITY</p><h3>CERTIFICATE OF COMPLIANCE</h3><p>This is to certify that</p><strong>{draft.student_name}</strong><p>is enrolled under the <b>{formatProgramName(draft.program)}</b> and has successfully completed community service for <b>{formatDuration(selected.completed_hours)}</b>.</p><small>Issued on {formatManilaDate(new Date())}</small></div>
          <fieldset className="signature-picker"><legend>Authorized signatures</legend>{signatures.filter((entry) => entry.is_active).map((entry) => <label key={entry.id}><input type="checkbox" checked={selectedSignatures.includes(Number(entry.id))} onChange={(e) => setSelectedSignatures((value) => e.target.checked ? [...value, Number(entry.id)].slice(0, 3) : value.filter((id) => id !== Number(entry.id)))} /><img src={entry.image_data_url} alt="" /><span>{entry.full_name}<small>{entry.position}</small></span></label>)}</fieldset>
          <button className="submit-btn" type="button" disabled={busy || !draft.student_name.trim() || !draft.program.trim() || !selectedSignatures.length} onClick={issue}>{busy ? 'Issuing Certificate…' : 'Issue, Email & Prepare PDF'}</button>
        </>
      </section></Modal>}
    </div>
    </section>}
    {!awaitingOnly && activePanel === 'signatures' && <section className="clearance-panel" role="tabpanel" id="clearance-panel-signatures" aria-labelledby="clearance-tab-signatures" data-panel="signatures">
    <section className="table-card signature-management"><div className="table-header"><h3>E-Signature Management</h3><span>PNG/JPEG • max 1 MB</span></div>
      <form onSubmit={saveSignature} className="signature-form"><label>Officer full name<input required value={signatureForm.full_name} onChange={(e) => setSignatureForm({ ...signatureForm, full_name: e.target.value })} /></label><label>Position<input required value={signatureForm.position} onChange={(e) => setSignatureForm({ ...signatureForm, position: e.target.value })} /></label><label>Signature image<input required={!signatureForm.image_data_url} type="file" accept="image/png,image/jpeg" onChange={readSignature} /></label>{signatureForm.image_data_url && <img src={signatureForm.image_data_url} alt="Signature preview" />}<button disabled={busy} className="submit-btn">Save Signature</button></form>
      <div className="signature-directory">{signatures.map((entry) => <article key={entry.id}><div className="signature-card-heading"><span className={`status-badge ${entry.is_active ? 'status-completed' : 'status-inactive'}`}>{entry.is_active ? 'Active' : 'Inactive'}</span><small>Updated {formatManilaDate(entry.updated_at)}</small></div><img src={entry.image_data_url} alt={`Signature of ${readableOfficerName(entry.full_name)}`} /><strong>{readableOfficerName(entry.full_name)}</strong><span>{entry.position}</span><div className="inline-actions"><button type="button" disabled={busy} onClick={() => editSignature(entry)}>Edit</button><button className={entry.is_active ? 'danger-button' : ''} type="button" disabled={busy} onClick={() => entry.is_active ? setDeactivating(entry) : toggleSignature(entry)}>{entry.is_active ? 'Deactivate' : 'Activate'}</button></div></article>)}</div>
    </section>
    </section>}
    {!awaitingOnly && activePanel === 'history' && <section className="clearance-panel" role="tabpanel" id="clearance-panel-history" aria-labelledby="clearance-tab-history" data-panel="history">
    <section className="table-card"><div className="table-header"><h3>Issued Certificate History</h3><span>{certificates.length} records</span></div>{certificates.length ? <div className="table-wrap"><table className="management-record-table"><thead><tr><th>Certificate</th><th>Student</th><th>Completed service</th><th>Status</th><th>Email</th><th>Actions</th></tr></thead><tbody>{certificates.map((entry) => <tr key={entry.id} id={`certificate-record-${entry.id}`} tabIndex={-1}><td data-label="Certificate">{entry.certificate_number}<br/><small>Version {entry.version}</small></td><td data-label="Student">{entry.student_name}<br/><small>{entry.student_number}</small></td><td data-label="Completed service">{formatDuration(entry.completed_hours)}</td><td data-label="Status"><span className={`status-badge ${entry.status === 'ISSUED' ? 'status-completed' : 'status-revoked'}`}>{entry.status}</span></td><td data-label="Email">{entry.email_status}</td><td data-label="Actions"><div className="inline-actions"><button type="button" onClick={() => downloadPdf(`/api/clearance/certificates/${entry.id}/pdf`, token, `${entry.certificate_number}.pdf`)}>Download</button>{entry.status === 'ISSUED' && <><button type="button" onClick={() => jsonRequest(`/api/clearance/certificates/${entry.id}/email`, token, { method: 'POST', body: '{}' }).then(load).catch((e) => setError(e.message))}>Email</button><button className="danger-button" type="button" onClick={() => { setRevoking(entry); setRevokeReason(''); setRevokeError('') }}>Revoke</button></>}</div></td></tr>)}</tbody></table></div> : <p className="empty-state">No clearance certificates have been issued.</p>}</section>
    </section>}
    </div>
    {editing && <Modal title="Edit E-Signature" dirty={editForm.full_name !== editing.full_name || editForm.position !== editing.position || Boolean(editForm.image_data_url)} onClose={() => !busy && setEditing(null)}><form className="signature-edit-form" onSubmit={saveSignatureEdit} noValidate><p className="modal-help">Update the officer details and optionally replace the current signature image.</p>{editErrors.form && <p className="error-message" role="alert">{editErrors.form}</p>}<label>Officer Full Name<input value={editForm.full_name} aria-invalid={Boolean(editErrors.full_name)} onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })} />{editErrors.full_name && <small className="field-error">{editErrors.full_name}</small>}</label><label>Position/Role<input value={editForm.position} aria-invalid={Boolean(editErrors.position)} onChange={(event) => setEditForm({ ...editForm, position: event.target.value })} />{editErrors.position && <small className="field-error">{editErrors.position}</small>}</label><div className="signature-preview-grid"><figure><figcaption>Current signature</figcaption><img src={editing.image_data_url} alt={`Current signature of ${readableOfficerName(editing.full_name)}`} /></figure><figure><figcaption>Replacement preview</figcaption>{editForm.image_data_url ? <img src={editForm.image_data_url} alt="Replacement signature preview" /> : <span>Current image will be kept</span>}</figure></div><label>Signature Image <small>Optional · PNG/JPEG · max 1 MB</small><input type="file" accept="image/png,image/jpeg" onChange={readEditSignature} />{editErrors.image && <small className="field-error">{editErrors.image}</small>}</label><footer className="modal-actions"><button type="button" disabled={busy} data-modal-dismiss>Cancel</button><button className="submit-btn" disabled={busy}>{busy ? 'Saving changes…' : 'Save Changes'}</button></footer></form></Modal>}
    {deactivating && <Modal title="Deactivate E-Signature" onClose={() => !busy && setDeactivating(null)}><div className="confirmation-dialog"><p>Deactivate the signature for <strong>{readableOfficerName(deactivating.full_name)}</strong>?</p><p>It will remain on certificates that have already been issued.</p><footer className="modal-actions"><button type="button" disabled={busy} onClick={() => setDeactivating(null)}>Cancel</button><button className="danger-button" type="button" disabled={busy} onClick={() => toggleSignature(deactivating)}>{busy ? 'Deactivating…' : 'Deactivate'}</button></footer></div></Modal>}
    {approving && <Modal title="Approve student clearance" onClose={() => !busy && setApproving(null)}><form className="confirmation-dialog" onSubmit={(event) => { event.preventDefault(); approveClearance() }}><p>Approve clearance for <strong>{approving.student_name}</strong> ({approving.student_number})?</p><p><strong>{formatDuration(approving.completed_hours)}</strong> of <strong>{formatDuration(approving.required_hours)}</strong> completed. The system will verify the requirements again before approval.</p>{approving.clearance_id ? <p>{approving.academic_year && approving.semester ? <>Clearance term: <strong>{approving.academic_year}</strong> · <strong>{approving.semester}</strong></> : 'The existing clearance record will be approved.'}</p> : <div className="approval-term-fields"><label>Academic year<input required pattern="\d{4}-\d{4}" placeholder="2026-2027" value={approvalTerm.academic_year} onChange={(event) => setApprovalTerm({ ...approvalTerm, academic_year: event.target.value })} /></label><label>Semester<select value={approvalTerm.semester} onChange={(event) => setApprovalTerm({ ...approvalTerm, semester: event.target.value })}><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select></label></div>}{approveError && <p className="error-message" role="alert">{approveError}</p>}<footer className="modal-actions"><button type="button" disabled={busy} onClick={() => setApproving(null)}>Cancel</button><button className="submit-btn" type="submit" disabled={busy || (!approving.clearance_id && !/^\d{4}-\d{4}$/.test(approvalTerm.academic_year))}>{busy ? 'Approving…' : 'Approve Clearance'}</button></footer></form></Modal>}
    {revoking && <Modal title="Revoke certificate" dirty={Boolean(revokeReason.trim())} onClose={() => !busy && setRevoking(null)}><form className="confirmation-dialog" onSubmit={(event) => { event.preventDefault(); revoke() }}><p>Revoke <strong>{revoking.certificate_number}</strong> for <strong>{revoking.student_name}</strong>? The certificate history and your reason will be retained.</p><label>Reason for revocation<textarea required value={revokeReason} disabled={busy} onChange={(event) => setRevokeReason(event.target.value)} rows={3}/></label>{revokeError && <p role="alert" className="error-message">{revokeError}</p>}<footer className="modal-actions"><button type="button" data-modal-dismiss disabled={busy}>Cancel</button><button type="submit" className="danger-button" disabled={busy || !revokeReason.trim()}>{busy ? 'Revoking…' : 'Revoke certificate'}</button></footer></form></Modal>}
  </section>
}

export default AdminClearanceCertificates
