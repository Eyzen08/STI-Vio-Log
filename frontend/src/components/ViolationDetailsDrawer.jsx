import Modal from './Modal.jsx'
import PortalIcon from './PortalIcon.jsx'
import ViolationDrawerContext, { ViolationSectionHeading } from './ViolationDrawerContext.jsx'
import { parseViolationDescription } from '../lib/violationAdmin.js'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime } from '../lib/displayFormat.js'
import '../styles/violation-drawers.css'

export function ViolationDetailsContent({ violation, student, role, onEdit, onAdd, canAdd }) {
  const parsed = parseViolationDescription(violation.description || '')
  const offense = violation.exact_offense || parsed.exact_offense || violation.violation_name || 'Not recorded'
  const notes = violation.incident_details || parsed.incident_details
  const distinctNotes = notes?.trim().toLowerCase() !== offense.trim().toLowerCase() ? notes : ''
  const remaining = Math.max(0, Number(violation.required_service_hours) - Number(violation.completed_service_hours))
  const metrics = [
    ['Offense', offense, 'registrations', 'neutral'],
    ['Classification', formatDisplayLabel(violation.severity, 'Not recorded'), 'violations', String(violation.severity).toLowerCase()],
    ['Incident Date & Time', formatIncidentDateTime(violation.incident_date, violation.incident_time), 'calendar', 'blue'],
    ['Required Service', formatDuration(violation.required_service_hours), 'clock', 'neutral'],
    ['Completed Service', formatDuration(violation.completed_service_hours), 'check', 'green'],
    ['Remaining Service', formatDuration(remaining), 'hourglass', 'orange']
  ]
  return <div className="violation-details-content">
    <ViolationDrawerContext violation={violation} student={student}/>
    <section className="violation-detail-section"><ViolationSectionHeading title="Incident Summary" subtitle="Key details about this violation record."/><dl className="violation-incident-metrics">{metrics.map(([label, value, icon, tone]) => <div key={label} className={`violation-incident-metric incident-tone-${tone}`}><i><PortalIcon name={icon} size={23}/></i><div><dt>{label}</dt><dd>{value}</dd>{label === 'Classification' && violation.violation_name && <p>{violation.violation_name}</p>}{label === 'Remaining Service' && <small>Hours use decimal values: 1.5 = 1 hour 30 minutes.</small>}</div></div>)}</dl></section>
    <section className="violation-detail-section"><ViolationSectionHeading title="Incident Details" subtitle="Handbook offense and additional incident information."/><dl className="violation-incident-notes"><div><dt>Handbook Offense</dt><dd>{offense}</dd></div><div><dt>Incident Notes</dt><dd>{distinctNotes || 'No additional incident notes recorded.'}</dd></div></dl></section>
    <section className="violation-detail-section"><ViolationSectionHeading icon="settings" title="Quick Actions" subtitle="Manage this violation record or create a new one for this student."/><div className="violation-quick-actions">{(violation.status === 'OPEN' || role === 'DISCIPLINE_ADMIN') && <button type="button" className="violation-drawer-primary" onClick={onEdit}><PortalIcon name="edit"/>{violation.status === 'OPEN' ? 'Edit audited record' : 'Reopen to edit'}</button>}<button type="button" className="violation-drawer-secondary" onClick={onAdd} disabled={!canAdd}><span aria-hidden="true">＋</span>Add violation for this student</button></div></section>
    <aside className="violation-retention-note"><PortalIcon name="info" size={26}/><p>Service hours, attendance records, and case history are retained even if this record is edited or cancelled.</p></aside>
  </div>
}

export default function ViolationDetailsDrawer({ onClose, ...props }) {
  return <Modal title={`Violation #${props.violation.id}`} className="violation-details-modal" drawer onClose={onClose}><ViolationDetailsContent {...props}/></Modal>
}
