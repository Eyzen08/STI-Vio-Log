import { useState } from 'react'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import ManagementMetric from './ManagementMetric.jsx'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import AsyncActionButton from './AsyncActionButton.jsx'
import { communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, headsForDepartment, normalizedRequiredMinutes, serviceDepartmentOptions } from '../lib/communityServiceAdmin.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { formatDisplayLabel, formatDuration } from '../lib/displayFormat.js'
import '../styles/community-workflow.css'

export function ServiceAssignmentContent({ assignment, student }) {
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
  </div>
}

export function AssignServiceForm({ form, students=[], violations=[], assignments=[], destinations=[], busy, error, success, onFieldChange, onSubmit }) {
  const [attempted, setAttempted] = useState(false)
  const eligible = eligibleServiceViolations(violations, assignments, form.student_id)
  const departments = serviceDepartmentOptions(destinations)
  const heads = headsForDepartment(destinations, form.department_id)
  const errors = attempted ? {
    student_search: !form.student_id && 'Select a matching student from the results.',
    violation_id: !eligible.some(item => Number(item.id) === Number(form.violation_id)) && 'Select an available open violation.',
    required_hours: !normalizedRequiredMinutes(form) && 'Enter required hours or minutes.',
    department_id: !form.department_id && 'Select a service department.',
    department_head_id: !heads.some(item => Number(item.department_head_id) === Number(form.department_head_id)) && 'Select the accountable Department Head.'
  } : {}
  const field = (name) => ({ name, id:`assign-${name}`, value:form[name], onChange:onFieldChange, 'aria-invalid':Boolean(errors[name]), 'aria-describedby':errors[name] ? `assign-${name}-error` : undefined })
  const message = name => errors[name] && <span className="service-field-error" id={`assign-${name}-error`}>{errors[name]}</span>
  return <><div className="service-assignment-intro"><i><PortalIcon name="registrations" size={32}/></i><div><h3>Create a service assignment</h3><p>Connect an open violation to an accountable department head.</p></div></div>
    <form className="assign-service-form" aria-busy={busy} onSubmit={event => { setAttempted(true); if (!form.student_id || !eligible.some(item => Number(item.id) === Number(form.violation_id)) || !normalizedRequiredMinutes(form) || !form.department_id || !heads.some(item => Number(item.department_head_id) === Number(form.department_head_id))) { event.preventDefault(); return } onSubmit(event) }}>
      <fieldset disabled={busy}><legend className="sr-only">Service assignment details</legend><div className="assign-service-grid">
        <label>Student <b aria-hidden="true">*</b><input type="search" list="community-service-student-options" autoComplete="off" placeholder="Type a student number or name" {...field('student_search')} required/><datalist id="community-service-student-options">{students.map(student => <option key={student.id} value={communityServiceStudentLabel(student)}/>)}</datalist><small>Search by student number, first name, or last name, then select the matching result.</small>{message('student_search')}</label>
        <label>Open violation <b aria-hidden="true">*</b><select {...field('violation_id')} disabled={!form.student_id} required><option value="">{form.student_id ? 'Select an open violation' : 'Select a student first'}</option>{eligible.map(item => <option key={item.id} value={item.id}>{communityServiceViolationLabel(item)}</option>)}</select>{form.student_id && !eligible.length ? <small>No open violations are available for this student.</small> : null}{message('violation_id')}</label>
        <label>Required hours <b aria-hidden="true">*</b><input type="number" min="0" step="1" {...field('required_hours')}/>{message('required_hours')}</label>
        <label>Required minutes<input type="number" inputMode="numeric" min="0" step="1" {...field('required_minutes')}/><small>Values of 60 or more are automatically converted to hours.</small></label>
        <label>Service department type <b aria-hidden="true">*</b><select {...field('department_id')} required><option value="">Select a department type</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{message('department_id')}</label>
        <label>Department Head <b aria-hidden="true">*</b><select {...field('department_head_id')} disabled={!form.department_id} required><option value="">{form.department_id ? 'Select the accountable Department Head' : 'Select a department first'}</option>{heads.map(item => <option key={item.department_head_id} value={item.department_head_id}>{item.first_name} {item.last_name}</option>)}</select>{form.department_id && !heads.length ? <small>No active Department Head is assigned to this department.</small> : null}{message('department_head_id')}</label>
      </div></fieldset>
      {error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-message" role="status">{success}</p>}
      <AsyncActionButton type="submit" busy={busy} busyLabel="Saving assignment…" onClick={() => setAttempted(true)}>Save Assignment</AsyncActionButton>
    </form></>
}

export default function CommunityServiceManagement({ students=[], assignments=[], activeSessions=[], attendanceReady, loading, filters, onFiltersChange, pendingResults, onAssign, formOpen, onCloseForm, formProps, viewingAssignment, onView, onCloseAssignment }) {
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
    <header className="service-page-header"><div><nav aria-label="Breadcrumb">Home / Community Service</nav><h2>Community Service</h2><p>Track assignments, time logs, accountable departments, and student progress.</p></div><button type="button" onClick={onAssign}>＋ Assign Service</button></header>
    <div className="service-summary-grid" aria-label="Community service summary"><ManagementMetric icon="registrations" value={active.length} label="Active Assignments"/><ManagementMetric tone="green" icon="clock" value={attendanceReady ? timedIn : '—'} label="Students Timed In"/><ManagementMetric tone="orange" icon="hourglass" value={active.filter(item => Number(item.remaining_hours)>0 && Number(item.remaining_hours)<=2).length} label="Near Completion"/><ManagementMetric tone="red" icon="violations" value={active.filter(item => Number(item.remaining_hours)>=Number(item.required_hours||0)).length} label="Not Started"/><ManagementMetric tone="green" icon="check" value={assignments.filter(item => ['COMPLETED','CLEARED'].includes(String(item.status).toUpperCase())).length} label="Completed"/></div>
    {pendingResults}
    <section className="service-tracking-card"><header><div><h3>Community Service Tracking</h3><p>Required, completed, and remaining time per assignment.</p><small>{assignments.length} {assignments.length===1?'assignment':'assignments'}</small></div><div className="service-tracking-filters"><label><PortalIcon name="search"/><input type="search" name="service-assignment-filter" autoComplete="off" aria-label="Search service assignments" value={filters.search} onChange={event=>onFiltersChange({...filters,search:event.target.value})} placeholder="Search student, number, or department…"/></label><select aria-label="Filter service department" value={filters.department} onChange={event=>onFiltersChange({...filters,department:event.target.value})}><option value="ALL">All departments</option>{departmentOptions.map(item=><option key={item.id} value={String(item.id)}>{item.name}</option>)}</select><select aria-label="Filter service status" value={filters.status} onChange={event=>onFiltersChange({...filters,status:event.target.value})}><option value="ALL">All statuses</option>{[...new Set(['OPEN','IN_PROGRESS','COMPLETED','CLEARED',...assignments.map(item=>item.status).filter(Boolean)])].map(status=><option key={status} value={status}>{formatDisplayLabel(status)}</option>)}</select></div></header>
      {loading ? <p className="service-empty" role="status">Loading community service assignments…</p> : !visible.length ? <p className="service-empty">No community service assignments match the current filters.</p> : <div className="service-table-wrap" tabIndex="0" role="region" aria-label="Community service assignments"><table className="service-tracking-table"><thead><tr>{['ID','Student','Violation','Department','Department Head','Required','Remaining','Progress','Status','Action'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(item=> {
        const required=Number(item.required_hours||0), remaining=Number(item.remaining_hours??required)
        const progress=required>0?Math.min(100,Math.round((required-remaining)/required*100)):0
        return <tr key={item.id}><td>#{item.id}</td><td><strong>{[item.first_name,item.last_name].filter(Boolean).join(' ') || 'Student record'}</strong><small>{item.student_number || `Student #${item.student_id}`}</small><AttendanceIndicator sessions={activeSessions.filter(session=>Number(session.assignment_id)===Number(item.id))} ready={attendanceReady} loading={loading}/></td><td>#{item.violation_id}</td><td>{item.department_code||item.department_name||'Historical assignment'}</td><td>{[item.department_head_first_name,item.department_head_last_name].filter(Boolean).join(' ')||'Not recorded'}</td><td>{formatDuration(item.required_hours)}</td><td>{formatDuration(remaining)}</td><td><progress aria-label={`Assignment ${item.id} progress`} value={progress} max="100">{progress}%</progress><small>{progress}%</small></td><td><span className={`service-status service-status-${(item.status||'OPEN').toLowerCase()}`}>{formatDisplayLabel(item.status||'OPEN')}</span></td><td><button type="button" aria-label={`View service assignment ${item.id}`} onClick={()=>onView(item)}>View</button></td></tr>
      })}</tbody></table></div>}
    </section>
    {formOpen && <Modal title="Assign Community Service" className="assign-service-modal service-workflow-modal" drawer onClose={onCloseForm}><AssignServiceForm {...formProps} students={students} assignments={assignments}/></Modal>}
    {viewingAssignment && <Modal title={`Service assignment #${viewingAssignment.id}`} className="service-assignment-modal service-workflow-modal" drawer onClose={onCloseAssignment}><ServiceAssignmentContent assignment={viewingAssignment} student={students.find(item=>Number(item.id)===Number(viewingAssignment.student_id))}/></Modal>}
  </section>
}
