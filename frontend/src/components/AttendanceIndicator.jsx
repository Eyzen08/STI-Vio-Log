import { isActiveServiceSession } from '../lib/departmentService.js'

export default function AttendanceIndicator({ sessions = [], ready = true, loading = false, details = false }) {
  const active = ready && sessions.some(isActiveServiceSession)
  const label = !ready ? (loading ? 'Loading attendance…' : 'Attendance unavailable') : active ? 'TIME IN' : 'TIME OUT'
  return <span className={`attendance-indicator attendance-indicator--${!ready ? 'unknown' : active ? 'in' : 'out'}`}>
    <span className="attendance-indicator-label"><i aria-hidden="true"/>{label}</span>
    {details && ready && <small>{active ? 'Currently serving' : 'Not currently serving'}</small>}
  </span>
}
