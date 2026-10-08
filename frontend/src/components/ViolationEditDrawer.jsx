import { useEffect, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { useActionLock } from '../lib/asyncAction.js'
import { buildViolationUpdatePayload, offensesForType, selectedViolationType, validateViolationEditForm, violationEditForm } from '../lib/violationAdmin.js'
import { headsForDepartment, serviceDepartmentOptions } from '../lib/communityServiceAdmin.js'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import Modal from './Modal.jsx'
import AsyncActionButton from './AsyncActionButton.jsx'
import PortalIcon from './PortalIcon.jsx'
import ViolationDrawerContext from './ViolationDrawerContext.jsx'
import '../styles/violation-drawers.css'

export default function ViolationEditDrawer({ violation, student, types, assignments, destinations, role, token, onClose, onChanged }) {
  const [form, setForm] = useState(() => violationEditForm(violation))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const [focusField, setFocusField] = useState(null)
  const formRef = useRef(null)
  const runAction = useActionLock()
  const isAdmin = role === 'DISCIPLINE_ADMIN'
  const isOpen = violation.status === 'OPEN'
  const assignment = assignments.find((item) => Number(item.violation_id) === Number(violation.id))
  const type = selectedViolationType(types, form.violation_type_id)
  const offenses = offensesForType(type)
  const needsDestination = !assignment && Number(form.required_service_hours) > 0
  const heads = headsForDepartment(destinations, form.department_id)
  const dirty = JSON.stringify(form) !== JSON.stringify(violationEditForm(violation))

  useEffect(() => {
    if (focusField) { formRef.current?.querySelector(`[name="${focusField}"]`)?.focus(); setFocusField(null) }
  }, [focusField, errors])
  useEffect(() => {
    if (confirmCancel) formRef.current?.querySelector('.violation-cancel-confirm button')?.focus()
  }, [confirmCancel])

  useEffect(() => {
    let current = true
    fetch(`${API_URL}/api/violations/${violation.id}/actions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load case history.')
        if (current) setHistory(data)
      }).catch((failure) => { if (current) setHistoryError(failure.message) })
    return () => { current = false }
  }, [violation.id, token])

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value,
      ...(field === 'violation_type_id' ? { exact_offense: '' } : {}),
      ...(field === 'department_id' ? { department_head_id: '' } : {})
    }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }
  const fieldError = (field) => errors[field] && <span id={`edit-${field}-error`} className="error-message">{errors[field]}</span>
  const fieldProps = (field) => ({ id: `edit-${field}`, name: field, value: form[field],
    onChange: (event) => change(field, event.target.value), 'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `edit-${field}-error` : undefined })
  const validate = (reasonOnly = false) => {
    const nextErrors = reasonOnly ? (!form.reason.trim() || form.reason.trim().length > 1000 ? { reason: 'Enter a reason of 1 to 1000 characters.' } : {})
      : validateViolationEditForm(form, violation, types, Boolean(assignment))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setFocusField(Object.keys(nextErrors)[0])
      return false
    }
    return true
  }
  const submit = async (action) => {
    if (!validate(Boolean(action))) return
    return runAction('violation-edit', async () => {
      setBusy(true); setError('')
      try {
        const response = await fetch(`${API_URL}/api/violations/${violation.id}${action ? '/actions' : ''}`, {
          method: action ? 'POST' : 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(action ? { action, reason: form.reason.trim() } : buildViolationUpdatePayload(form, violation, Boolean(assignment)))
        })
        const data = await response.json()
        if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to save this change.')
        onChanged(data, action)
      } catch (failure) { setError(failure.message) }
      finally { setBusy(false) }
    })
  }

  return <Modal title={`${isOpen ? 'Edit' : 'Review'} violation #${violation.id}`} className="violation-edit-modal" drawer dirty={dirty} onClose={() => { if (!busy) onClose() }}>
    <div className="violation-edit-content">
      <ViolationDrawerContext violation={violation} student={student}/>
      {!isOpen && <p className="violation-reopen-guidance">Reopen this case with a reason before changing its offense or service hours.</p>}
      <form ref={formRef} className="violation-audited-form" noValidate aria-busy={busy} onSubmit={(event) => { event.preventDefault(); submit(isOpen ? undefined : 'REOPEN') }}>
        <fieldset disabled={busy || !isOpen} className="violation-edit-section">
          <legend className="sr-only">Incident</legend><h3>Incident</h3>
          <div className="violation-edit-grid">
            <label>Classification <span className="violation-required" aria-hidden="true">*</span><select {...fieldProps('violation_type_id')} required><option value="">Select a classification</option>{!type && <option value={form.violation_type_id}>{violation.violation_name || 'Existing classification'}</option>}{types.map((item) => <option key={item.id} value={item.id}>{item.violation_name} ({item.severity})</option>)}</select>{fieldError('violation_type_id')}</label>
            <label>Handbook Offense {!form.legacy && <span className="violation-required" aria-hidden="true">*</span>}<select {...fieldProps('exact_offense')} required={!form.legacy}><option value="">{form.legacy ? 'Keep legacy description' : 'Select the offense'}</option>{form.exact_offense && !offenses.includes(form.exact_offense) && <option value={form.exact_offense}>{form.exact_offense} (recorded)</option>}{offenses.map((offense) => <option key={offense}>{offense}</option>)}</select>{fieldError('exact_offense')}</label>
            <label>Incident Date <span className="violation-required" aria-hidden="true">*</span><input type="date" {...fieldProps('incident_date')} required/>{fieldError('incident_date')}</label>
            <label>Incident Time <span className="violation-optional">(optional)</span><input type="time" {...fieldProps('incident_time')}/>{fieldError('incident_time')}</label>
            <label className="violation-full-width">Incident Details<textarea rows="3" {...fieldProps('incident_details')} required/>{fieldError('incident_details')}{form.legacy && <small>Existing description is preserved here. Selecting an offense will keep these details.</small>}</label>
          </div>
        </fieldset>
        <fieldset disabled={busy || !isOpen} className="violation-edit-section">
          <legend className="sr-only">Community service</legend><h3>Community service</h3>
          <div className="violation-service-edit-grid">
            <label>Required Hours <span className="violation-required" aria-hidden="true">*</span><input type="number" inputMode="decimal" min="0" max="9999.99" step="0.01" {...fieldProps('required_service_hours')} required/>{fieldError('required_service_hours')}</label>
            <label>Completed Hours <span className="violation-required" aria-hidden="true">*</span><input type="number" inputMode="decimal" min="0" max="9999.99" step="0.01" {...fieldProps('completed_service_hours')} disabled={!isAdmin} required/>{fieldError('completed_service_hours')}{!isAdmin && <small>Only admins can correct credited hours.</small>}</label>
          </div>
          <p className="violation-hours-guidance">Decimal hours: 1.5 = 1 hr 30 min.</p>
          <p className="violation-remaining-line" aria-live="polite">Remaining <strong>{formatDuration(Math.max(0, Number(form.required_service_hours) - Number(form.completed_service_hours)))}</strong></p>
          {needsDestination && <div className="violation-edit-grid violation-destination-fields"><label>Department <span className="violation-required" aria-hidden="true">*</span><select {...fieldProps('department_id')} required><option value="">Select a department</option>{serviceDepartmentOptions(destinations).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select>{fieldError('department_id')}</label><label>Department Head <span className="violation-required" aria-hidden="true">*</span><select {...fieldProps('department_head_id')} disabled={!form.department_id} required><option value="">Select a Department Head</option>{heads.map((head) => <option key={head.department_head_id} value={head.department_head_id}>{head.first_name} {head.last_name}</option>)}</select>{fieldError('department_head_id')}{form.department_id && !heads.length && <small>No active Department Head is available for this department.</small>}</label></div>}
        </fieldset>
        <section className="violation-audit-section">
          <label>Reason for {isOpen ? 'change' : 'reopening'} <span className="violation-required" aria-hidden="true">*</span><textarea rows="2" {...fieldProps('reason')} maxLength="1000" disabled={busy} required placeholder="Explain why this record needs to change"/>{fieldError('reason')}<small className="violation-character-count" aria-hidden="true">{form.reason.length}/1000</small></label>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
        <ViolationEditHistory violation={violation} history={history} error={historyError}/>
        <footer className="violation-edit-footer">
          {confirmCancel ? <section className="violation-cancel-confirm" role="alert"><h4>Cancel violation #{violation.id}?</h4><p>This removes the case from active obligations and offense counts. The record, attendance, and reason remain in history. Unsaved edits will not be applied.</p><div className="violation-edit-actions"><AsyncActionButton type="button" className="violation-drawer-danger" busy={busy} busyLabel="Cancelling…" onClick={() => submit('INVALID_CANCEL')}>Confirm cancellation</AsyncActionButton><button type="button" className="violation-drawer-secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep violation</button></div></section>
            : <div className="violation-edit-actions">{(isOpen || isAdmin) && <AsyncActionButton type="submit" className="violation-drawer-primary" busy={busy} busyLabel="Saving…"><PortalIcon name="save"/>{isOpen ? 'Save changes' : 'Reopen to edit'}</AsyncActionButton>}<button type="button" className="violation-drawer-secondary" disabled={busy} data-modal-dismiss>Close</button>{isOpen && isAdmin && <button type="button" className="violation-drawer-danger violation-cancel-button" disabled={busy} onClick={() => { if (validate(true)) setConfirmCancel(true) }}><PortalIcon name="trash"/>Cancel violation</button>}</div>}
        </footer>
      </form>
    </div>
  </Modal>
}

export function ViolationEditHistory({ violation, history, error }) {
  return <details className="violation-edit-history">
    <summary tabIndex={0}>History</summary>
    <div className="violation-edit-history-grid">
      <section className="violation-history-card"><h4>Case events</h4>{error ? <p className="error-message" role="alert">{error}</p> : !history ? <p role="status">Loading history…</p> : <>
        {!history.actions?.some((action) => action.action === 'CREATE') && <p>{violation.created_at ? <>Created on {formatManilaDateTime(violation.created_at)}</> : 'Creation time not recorded.'}</p>}
        {history.actions?.map((action) => <article key={action.id}><strong>{formatDisplayLabel(action.action)}</strong><time>{formatManilaDateTime(action.created_at)}</time>{action.from_status && action.to_status && <p>{formatDisplayLabel(action.from_status)} → {formatDisplayLabel(action.to_status)}</p>}{action.reason && <p>{action.reason}</p>}<small>{formatDisplayLabel(action.performed_by_role, 'Staff')}{action.performed_by_user_id != null && ` · User #${action.performed_by_user_id}`}</small></article>)}
      </>}</section>
      <section className="violation-history-card"><h4>Hour corrections</h4>{error ? <p>Corrections could not be loaded.</p> : !history ? <p role="status">Loading corrections…</p> : !history.hourCorrections?.length ? <p>No completed-hour corrections recorded.</p> : history.hourCorrections.map((item) => <article key={item.id}><strong>{formatDuration(item.previous_completed_hours)} → {formatDuration(item.new_completed_hours)}</strong><time>{formatManilaDateTime(item.created_at)}</time><p>{item.reason}</p>{item.performed_by_user_id != null && <small>Administrator #{item.performed_by_user_id}</small>}</article>)}</section>
    </div>
  </details>
}
