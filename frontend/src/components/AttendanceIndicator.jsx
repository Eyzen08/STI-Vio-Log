import { isActiveServiceSession } from '../lib/departmentService.js'

export default function AttendanceIndicator({ sessions = [], ready = true, loading = false, details = false }) {
  const active = ready && sessions.some(isActiveServiceSession)
  const label = !ready ? (loading ? 'Loading Attendance…' : 'Attendance Unavailable') : active ? 'Time In' : 'Time Out'
  return <span className={`attendance-indicator attendance-indicator--${!ready ? 'unknown' : active ? 'in' : 'out'}`}>
    <span className="attendance-indicator-label"><i aria-hidden="true"/>{label}</span>
    {details && ready && <small>{active ? 'Currently Serving' : 'Not Currently Serving'}</small>}
  </span>
}
