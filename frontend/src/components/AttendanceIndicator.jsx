import { isActiveServiceSession } from '../lib/departmentService.js'

export default function AttendanceIndicator({ sessions = [], ready = true, loading = false, details = false }) {
  const active = ready && sessions.some(isActiveServiceSession)
  const paused = active && sessions.filter(isActiveServiceSession).every(session => session.paused_at)
  const invalidated=!active && sessions.length>0 && sessions.every(session=>session.day_invalidation_id || session.day_invalidation)
  const label = !ready ? (loading ? 'Loading Attendance…' : 'Attendance Unavailable') : paused ? 'Paused' : active ? 'Time In' : invalidated ? 'Day Invalidated' : 'Time Out'
  return <span className={`attendance-indicator attendance-indicator--${!ready ? 'unknown' : active ? 'in' : 'out'}`}>
    <span className="attendance-indicator-label"><i aria-hidden="true"/>{label}</span>
    {details && ready && <small>{paused ? 'Service Paused' : active ? 'Currently Serving' : 'Not Currently Serving'}</small>}
  </span>
}
