import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import RecordTargetFocus from './RecordTargetFocus.jsx'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import ManagementMetric from './ManagementMetric.jsx'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import AsyncActionButton from './AsyncActionButton.jsx'
import { communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, headsForDepartment, normalizedRequiredMinutes, serviceDepartmentOptions } from '../lib/communityServiceAdmin.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { formatDisplayLabel, formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import '../styles/community-workflow.css'

function ServiceSessionDetails({ assignmentId, sessionId, token }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!sessionId || !token) return
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch(`${API_URL}/api/community-service/${assignmentId}/sessions`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error('Attendance unavailable')
        if (!controller.signal.aborted) setSession((data.sessions || []).find((item) => String(item.id) === sessionId) || null)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [assignmentId, sessionId, token])
  if (!sessionId) return null
  return <>
    <RecordTargetFocus id={`service-session-${sessionId}`} loading={loading} error={error} />
    {loading ? <p role="status">Loading attendance session…</p> : session && <section className="service-detail-card" id={`service-session-${session.id}`} tabIndex={-1}>
      <h3>Attendance session #{session.id}</h3>
      <dl>{[
        ['Time in', formatManilaDateTime(session.time_in)], ['Time out', session.time_out ? formatManilaDateTime(session.time_out) : 'Pending'],
        ['Worked', formatDuration(Number(session.worked_minutes || 0) / 60)], ['Credited', session.credited_minutes == null ? 'Pending' : formatDuration(Number(session.credited_minutes) / 60)],
        ['Status', formatDisplayLabel(session.status)], ['Attendance outcome', formatDisplayLabel(session.attendance_outcome)],
        ['Recorded by', session.time_out_recorder_name || session.time_in_recorder_name || 'Not recorded'], ['Notes', session.result_notes || session.notes || '—']
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>}
  </>
}

export function ServiceAssignmentContent({ assignment, student, token, targetSessionId }) {
  const required = Number(assignment.required_hours || 0)
  const remaining = Number(assignment.remaining_hours ?? required)
  const completed = Math.max(0, required - remaining)
  const progress = required > 0 ? Math.min(100, Math.round(completed / required * 100)) : 0
  const status = assignment.status || 'OPEN'
  return <div className="service-assignment-content">
    <header className="service-student-card"><Avatar identity={student || assignment}/><div><h3>{[assignment.first_name, assignment.last_name].filter(Boolean).join(' ') || assignment.student_number || 'Student record'}</h3><p>{assignment.student_number || `Student #${assignment.student_id}`}</p></div><span className={`service-status service-status-${status.toLowerCase()}`}>{formatDisplayLabel(status)}</span></header>
    <section className="service-detail-card"><div className="service-section-heading"><i><PortalIcon name="registrations" size={30}/></i><div><h3>Community service assignment</h3><p>Details and time requirements for this service assignment.</p></div></div><dl>{[
      ['Violation', `#${assignment.violation_id}`],
      ['Department', assignment.department_name || assignment.department_code || 'Historical assignment'],
      ['Department head', [assignment.department_head_first_name, assignment.department_head_last_name].filter(Boolean).join(' ') || 'Not recorded'],
      ['Required time', formatDuration(required)], ['Completed time', formatDuration(completed)], ['Remaining time', formatDuration(remaining)]
    ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className="service-detail-card"><div className="service-section-heading service-heading-green"><i><PortalIcon name="clock" size={30}/></i><div><h3>Service progress</h3><p>Completed time against the required time.</p></div></div><div className="service-detail-progress"><progress aria-label="Completed service progress" max="100" value={progress}>{progress}%</progress><strong>{progress}%</strong></div></section>
    <ServiceSessionDetails key={`${assignment.id}:${targetSessionId || ''}`} assignmentId={assignment.id} sessionId={targetSessionId} token={token} />
  </div>
}

export function AssignServiceForm({ form, students=[], violations=[], assignments=[], destinations=[], busy, error, success, onFieldChange, onSubmit }) {
  const [attempted, setAttempted] = useState(false)
  const eligible = eligibleServiceViolations(violations, assignments, form.student_id)
  const departments = serviceDepartmentOptions(destinations)
  const heads = headsForDepartment(destinations, form.department_id)
  const requiredMinutes = normalizedRequiredMinutes(form)
  const validationErrors = {
    student_search: !form.student_id && 'Select a matching student from the results.',
    violation_id: !eligible.some(item => Number(item.id) === Number(form.violation_id)) && 'Select an available open violation.',
    required_hours: !(Number.isFinite(requiredMinutes) && requiredMinutes > 0) && 'Enter a total service time greater than zero.',
    department_id: !form.department_id && 'Select a service department.',
    department_head_id: !heads.some(item => Number(item.department_head_id) === Number(form.department_head_id)) && 'Select the accountable Department Head.'
  }
  const errors = attempted ? validationErrors : {}
  const field = (name, help, errorName = name) => ({ name, id:`assign-${name}`, 'aria-labelledby':`assign-${name}-label`, value:form[name] ?? '', onChange:onFieldChange, 'aria-invalid':Boolean(errors[errorName]), 'aria-describedby':[help, errors[errorName] && `assign-${errorName}-error`].filter(Boolean).join(' ') || undefined })
  const message = name => errors[name] && <span className="service-field-error" id={`assign-${name}-error`}>{errors[name]}</span>
  const submit = event => {
    setAttempted(true)
    const invalidField = Object.keys(validationErrors).find(name => validationErrors[name])
    if (invalidField) {
      event.preventDefault()
      event.currentTarget.elements.namedItem(invalidField)?.focus()
      return
    }
    onSubmit(event)
  }
  return <><div className="service-assignment-intro create-record-intro"><i><PortalIcon name="registrations" size={24}/></i><div><h3>Create a service assignment</h3><p>Connect an open violation to an accountable department head.</p></div></div>
    <form className="assign-service-form" aria-busy={busy} onInvalidCapture={() => setAttempted(true)} onSubmit={submit}>
      <fieldset disabled={busy}><legend className="sr-only">Service assignment details</legend><div className="assign-service-grid">
        <label><span id="assign-student_search-label">Student <b aria-hidden="true">*</b></span><input type="search" list="community-service-student-options" autoComplete="off" placeholder="02000123456 or Juan Dela Cruz" {...field('student_search', 'assign-student_search-help')} required/><datalist id="community-service-student-options">{students.map(student => <option key={student.id} value={communityServiceStudentLabel(student)}/>)}</datalist><small id="assign-student_search-help">Search by name or student number, then select the matching result.</small>{message('student_search')}</label>
        <label><span id="assign-violation_id-label">Open violation <b aria-hidden="true">*</b></span><select {...field('violation_id', 'assign-violation_id-help')} disabled={!form.student_id} required><option value="">{form.student_id ? 'Select an open violation' : 'Select a student first'}</option>{eligible.map(item => <option key={item.id} value={item.id}>{communityServiceViolationLabel(item)}</option>)}</select><small id="assign-violation_id-help">{form.student_id && !eligible.length ? 'No open violations are available for this student.' : 'Only open violations without a service assignment are listed.'}</small>{message('violation_id')}</label>
        <fieldset className="assign-service-duration"><legend>Required service time <b aria-hidden="true">*</b></legend>
          <button type="button" className="assign-service-preset" aria-pressed={Number(form.required_hours) === 48 && Number(form.required_minutes || 0) === 0} onClick={() => { onFieldChange({ target: { name:'required_hours', value:'48' } }); onFieldChange({ target: { name:'required_minutes', value:'0' } }) }}>Use 48 hours</button>
          <div className="assign-service-duration-inputs">
          <label><span id="assign-required_hours-label">Hours</span><input type="text" inputMode="numeric" pattern="[0-9]+" placeholder="48" {...field('required_hours', 'assign-duration-help')}/></label>
          <label><span id="assign-required_minutes-label">Minutes</span><input type="text" inputMode="numeric" pattern="[0-9]+" placeholder="0" {...field('required_minutes', 'assign-duration-help', 'required_hours')}/></label>
        </div><small id="assign-duration-help">Enter hours, minutes, or both. Minutes of 60 or more are converted to hours.</small>{message('required_hours')}<p className="assign-service-total" role="status">Total required time: <strong>{formatDuration(Number.isFinite(requiredMinutes) ? requiredMinutes / 60 : 0)}</strong></p></fieldset>
        <label><span id="assign-department_id-label">Service department type <b aria-hidden="true">*</b></span><select {...field('department_id', !departments.length ? 'assign-department_id-help' : undefined)} required><option value="">Select a department type</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!departments.length && <small id="assign-department_id-help">No service departments with an active Department Head are available.</small>}{message('department_id')}</label>
        <label><span id="assign-department_head_id-label">Department Head <b aria-hidden="true">*</b></span><select {...field('department_head_id', 'assign-department_head_id-help')} disabled={!form.department_id} required><option value="">{form.department_id ? 'Select the accountable Department Head' : 'Select a department first'}</option>{heads.map(item => <option key={item.department_head_id} value={item.department_head_id}>{item.first_name} {item.last_name}</option>)}</select><small id="assign-department_head_id-help">{form.department_id && !heads.length ? 'No active Department Head is assigned to this department.' : 'Select the head responsible for supervising this assignment.'}</small>{message('department_head_id')}</label>
      </div></fieldset>
      {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-message" role="status">{success}</p>}
      <div className="assign-service-actions create-record-actions"><button type="button" data-modal-dismiss="true" disabled={busy}>Cancel</button><AsyncActionButton type="submit" busy={busy} busyLabel="Saving assignment…" onClick={() => setAttempted(true)}>Save Assignment</AsyncActionButton></div>
    </form></>
}

export default function CommunityServiceManagement({ students=[], assignments=[], activeSessions=[], attendanceReady, loading, filters, onFiltersChange, pendingResults, onAssign, formOpen, onCloseForm, formProps, viewingAssignment, onView, onCloseAssignment, token, targetSessionId }) {
  const active = assignments.filter(item => !['COMPLETED','CLEARED'].includes(String(item.status).toUpperCase()))
  const timedIn = new Set(activeSessions.filter(isActiveServiceSession).map(item => item.student_id)).size
  const departmentOptions = serviceDepartmentOptions(formProps.destinations)
  const visible = assignments.filter(item => {
    const query = filters.search.trim().toLowerCase()
    return (!query || [item.first_name,item.last_name,item.student_number,item.department_name,item.department_code].filter(Boolean).join(' ').toLowerCase().includes(query))
      && (filters.status === 'ALL' || String(item.status || 'OPEN').toUpperCase() === filters.status)
      && (filters.department === 'ALL' || String(item.department_id || item.department_code || '') === filters.department)
  })
  return <section className="community-service-management">
    <header className="service-page-header portal-page-header"><div><nav aria-label="Breadcrumb">Home / Community Service</nav><h2>Community Service</h2><p>Track assignments, time logs, accountable departments, and student progress.</p></div><button type="button" onClick={onAssign}>＋ Assign Service</button></header>
    <div className="service-summary-grid" aria-label="Community service summary"><ManagementMetric icon="registrations" value={active.length} label="Active Assignments"/><ManagementMetric tone="green" icon="clock" value={attendanceReady ? timedIn : '—'} label="Students Timed In"/><ManagementMetric tone="orange" icon="hourglass" value={active.filter(item => Number(item.remaining_hours)>0 && Number(item.remaining_hours)<=2).length} label="Near Completion"/><ManagementMetric tone="red" icon="violations" value={active.filter(item => Number(item.remaining_hours)>=Number(item.required_hours||0)).length} label="Not Started"/><ManagementMetric tone="green" icon="check" value={assignments.filter(item => ['COMPLETED','CLEARED'].includes(String(item.status).toUpperCase())).length} label="Completed"/></div>
    {pendingResults}
    <section className="service-tracking-card"><header><div><h3>Community Service Tracking</h3><p>Required, completed, and remaining time per assignment.</p><small>{assignments.length} {assignments.length===1?'assignment':'assignments'}</small></div><div className="service-tracking-filters"><label><PortalIcon name="search"/><input type="search" name="service-assignment-filter" autoComplete="off" aria-label="Search service assignments" value={filters.search} onChange={event=>onFiltersChange({...filters,search:event.target.value})} placeholder="Search student, number, or department…"/></label><select aria-label="Filter service department" value={filters.department} onChange={event=>onFiltersChange({...filters,department:event.target.value})}><option value="ALL">All departments</option>{departmentOptions.map(item=><option key={item.id} value={String(item.id)}>{item.name}</option>)}</select><select aria-label="Filter service status" value={filters.status} onChange={event=>onFiltersChange({...filters,status:event.target.value})}><option value="ALL">All statuses</option>{[...new Set(['OPEN','IN_PROGRESS','COMPLETED','CLEARED',...assignments.map(item=>item.status).filter(Boolean)])].map(status=><option key={status} value={status}>{formatDisplayLabel(status)}</option>)}</select></div></header>
      {loading ? <p className="service-empty" role="status">Loading community service assignments…</p> : !visible.length ? <p className="service-empty">No community service assignments match the current filters.</p> : <div className="service-table-wrap" tabIndex="0" role="region" aria-label="Community service assignments"><table className="service-tracking-table"><thead><tr>{['ID','Student','Violation','Department','Department Head','Required','Remaining','Progress','Status','Action'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(item=> {
        const required=Number(item.required_hours||0), remaining=Number(item.remaining_hours??required)
        const progress=required>0?Math.min(100,Math.round((required-remaining)/required*100)):0
        return <tr key={item.id}><td>#{item.id}</td><td><strong>{[item.first_name,item.last_name].filter(Boolean).join(' ') || 'Student record'}</strong><small>{item.student_number || `Student #${item.student_id}`}</small><AttendanceIndicator sessions={activeSessions.filter(session=>Number(session.assignment_id)===Number(item.id))} ready={attendanceReady} loading={loading}/></td><td>#{item.violation_id}</td><td>{item.department_code||item.department_name||'Historical assignment'}</td><td>{[item.department_head_first_name,item.department_head_last_name].filter(Boolean).join(' ')||'Not recorded'}</td><td>{formatDuration(item.required_hours)}</td><td>{formatDuration(remaining)}</td><td><progress aria-label={`Assignment ${item.id} progress`} value={progress} max="100">{progress}%</progress><small>{progress}%</small></td><td><span className={`service-status service-status-${(item.status||'OPEN').toLowerCase()}`}>{formatDisplayLabel(item.status||'OPEN')}</span></td><td><button type="button" aria-label={`View service assignment ${item.id}`} onClick={()=>onView(item)}>View</button></td></tr>
      })}</tbody></table></div>}
    </section>
    {formOpen && <Modal title="Assign Community Service" className="assign-service-modal service-workflow-modal create-record-drawer" drawer onClose={onCloseForm}><AssignServiceForm {...formProps} students={students} assignments={assignments}/></Modal>}
    {viewingAssignment && <Modal title={`Service assignment #${viewingAssignment.id}`} className="service-assignment-modal service-workflow-modal" drawer onClose={onCloseAssignment}><ServiceAssignmentContent token={token} targetSessionId={targetSessionId} assignment={viewingAssignment} student={students.find(item=>Number(item.id)===Number(viewingAssignment.student_id))}/></Modal>}
  </section>
}
