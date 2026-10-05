import { formatDuration, formatManilaDateTime } from '../lib/displayFormat.js'

export default function ServiceHourCorrections({ corrections = [] }) {
  return <section className="service-hour-corrections" aria-label="Completed-hour corrections"><h4>Completed-hour corrections</h4><p>Administrative corrections are separate from recorded attendance credits.</p>{corrections.length ? <div className="registration-review-list">{corrections.map((item) => <article key={item.id}><strong>{item.student_number && `${item.student_number} · `}Assignment #{item.assignment_id}</strong><p>{formatDuration(item.previous_completed_hours)} → {formatDuration(item.new_completed_hours)} · {formatManilaDateTime(item.created_at)}</p><p>{item.reason}</p></article>)}</div> : <p>No completed-hour corrections recorded.</p>}</section>
}
