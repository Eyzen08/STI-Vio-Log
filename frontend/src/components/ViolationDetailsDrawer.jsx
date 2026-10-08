import Modal from './Modal.jsx'
import ViolationDrawerContext from './ViolationDrawerContext.jsx'
import { parseViolationDescription } from '../lib/violationAdmin.js'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime } from '../lib/displayFormat.js'
import '../styles/violation-drawers.css'

export function ViolationDetailsContent({ violation, student, role, onEdit, onAdd, canAdd }) {
  const parsed = parseViolationDescription(violation.description || '')
  const offense = violation.exact_offense || parsed.exact_offense || violation.violation_name || 'Not recorded'
  const notes = violation.incident_details || parsed.incident_details
  const distinctNotes = notes?.trim().toLowerCase() !== offense.trim().toLowerCase() ? notes?.trim() : ''
  const remaining = Math.max(0, Number(violation.required_service_hours) - Number(violation.completed_service_hours))
  return <div className="violation-details-content">
    <ViolationDrawerContext violation={violation} student={student}/>
    <section className="violation-detail-section">
      <h3>Incident</h3>
      <dl className="violation-incident-facts">
        <div className="violation-full-width"><dt>Offense</dt><dd>{offense}</dd></div>
        <div><dt>Classification</dt><dd>{violation.violation_name || 'Not recorded'}</dd></div>
        <div><dt>Severity</dt><dd>{formatDisplayLabel(violation.severity, 'Not recorded')}</dd></div>
        <div className="violation-full-width"><dt>Incident date & time</dt><dd>{formatIncidentDateTime(violation.incident_date, violation.incident_time)}</dd></div>
      </dl>
      {distinctNotes && <div className="violation-incident-notes"><h4>Incident notes</h4><p>{distinctNotes}</p></div>}
    </section>
    <section className="violation-detail-section">
      <h3>Community service</h3>
      <dl className="violation-service-summary">
        <div><dt>Required</dt><dd>{formatDuration(violation.required_service_hours)}</dd></div>
        <div><dt>Completed</dt><dd>{formatDuration(violation.completed_service_hours)}</dd></div>
        <div><dt>Remaining</dt><dd><strong>{formatDuration(remaining)}</strong></dd></div>
      </dl>
    </section>
    <div className="violation-quick-actions">
      {(violation.status === 'OPEN' || role === 'DISCIPLINE_ADMIN') && <button type="button" className="violation-drawer-primary" onClick={onEdit}>{violation.status === 'OPEN' ? 'Edit record' : 'Reopen to edit'}</button>}
      <button type="button" className="violation-drawer-secondary" onClick={onAdd} disabled={!canAdd}>Add violation</button>
    </div>
  </div>
}

export default function ViolationDetailsDrawer({ onClose, ...props }) {
  return <Modal title={`Violation #${props.violation.id}`} className="violation-details-modal" drawer onClose={onClose}><ViolationDetailsContent {...props}/></Modal>
}
