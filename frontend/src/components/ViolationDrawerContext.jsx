import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import { formatDisplayLabel } from '../lib/displayFormat.js'

export function ViolationSectionHeading({ icon = 'registrations', title, subtitle }) {
  return <header className="violation-section-heading"><i><PortalIcon name={icon} size={24}/></i><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></header>
}

export default function ViolationDrawerContext({ violation, student }) {
  const name = violation.student_name || (student && [student.first_name, student.middle_name, student.last_name, student.suffix].filter(Boolean).join(' ')) || violation.student_number || 'Student record'
  return <header className="violation-student-context"><Avatar identity={student || violation} className="violation-context-avatar"/><div><h3>{name}</h3><p>{violation.student_number || student?.student_number || 'Student number unavailable'}</p></div><span className={`violation-context-status context-status-${String(violation.status || '').toLowerCase()}`}><i aria-hidden="true"/>{formatDisplayLabel(violation.status)}</span></header>
}
