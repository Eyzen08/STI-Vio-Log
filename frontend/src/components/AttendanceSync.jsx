import './AttendanceSync.css'

export default function AttendanceSync({ sync, hasSocket }) {
  const { error, offline, connected, loading, lastSuccess, retry } = sync
  const connection = offline ? 'Offline' : hasSocket && !connected ? 'Reconnecting · automatic refresh active' : 'Automatic attendance refresh active'
  return <div className={`attendance-sync${error || offline ? ' attendance-sync--warning' : ''}`} role="status" aria-live="polite">
    <span>{connection}{lastSuccess ? <> · Last synced <time dateTime={new Date(lastSuccess).toISOString()}>{new Date(lastSuccess).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></> : ' · Waiting for attendance'}</span>
    {error && <span>{lastSuccess ? 'Last loaded attendance may be outdated.' : 'Attendance is currently unavailable.'}</span>}
    {(error || offline) && <button type="button" className="secondary-button" disabled={loading || offline} onClick={retry}>{loading ? 'Retrying…' : 'Retry Attendance'}</button>}
  </div>
}
