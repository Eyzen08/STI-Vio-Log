import { formatManilaDateTime } from '../lib/displayFormat.js'

export default function ServicePauseHistory({ session }) {
  const pauses = session?.pause_history || []
  if (!pauses.length) return null
  return <details className="service-pause-history"><summary>Pause History ({pauses.length})</summary><ol>{pauses.map(pause => <li key={pause.id}>
    <dl><div><dt>Paused</dt><dd>{formatManilaDateTime(pause.started_at)} · {pause.started_by_name || `Staff #${pause.started_by_user_id}`}</dd></div>
      <div><dt>{session.time_out && pause.ended_at === session.time_out ? 'Ended at Time Out' : 'Resumed'}</dt><dd>{pause.ended_at ? `${formatManilaDateTime(pause.ended_at)} · ${pause.ended_by_name || `Staff #${pause.ended_by_user_id}`}` : 'Still Paused'}</dd></div>
      <div><dt>Reason</dt><dd>{pause.reason}</dd></div></dl>
  </li>)}</ol></details>
}
