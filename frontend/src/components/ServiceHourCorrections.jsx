import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'
import PortalIcon from './PortalIcon.jsx'

export default function ServiceHourCorrections({ corrections = [], compact = false }) {
  return <section className="service-hour-corrections" aria-label="Completed-hour corrections"><h4>Completed-hour corrections</h4><div className={compact ? 'service-corrections-note' : undefined}>{compact && <i><PortalIcon name="info" size={23}/></i>}<div><p>Administrative corrections are separate from recorded attendance credits.</p>{!corrections.length && <p>No completed-hour corrections recorded.</p>}</div></div>{corrections.length > 0 && <div className="registration-review-list">{corrections.map((item) => <article key={item.id}><strong>{item.student_number && `${item.student_number} · `}Assignment #{item.assignment_id}</strong><p>{formatDuration(item.previous_completed_hours)} → {formatDuration(item.new_completed_hours)} · {formatManilaDateTime(item.created_at)}</p><p>{item.reason}</p></article>)}</div>}</section>
}
