import { useEffect, useState } from 'react'
import { isActiveServiceSession } from '../lib/departmentService.js'
import { formatManilaDateTime } from '../lib/displayFormat.js'
import AttendanceIndicator from './AttendanceIndicator.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'

export default function StudentAttendancePanel({ sessions = [], ready, loading, error }) {
  const active = sessions.filter(isActiveServiceSession)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active.length) return undefined
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [active.length])
  return <section className="student-attendance-panel" aria-label="Current attendance status">
    <header><h3>Current attendance</h3><AttendanceIndicator sessions={active} ready={ready} loading={loading} details/></header>
    {active.map((session) => <article className="student-current-session" key={session.id}>
      <div className="student-session-identity"><strong>{session.department_name || `Assignment #${session.assignment_id}`}</strong><span>Assignment #{session.assignment_id}</span><span>Started {formatManilaDateTime(session.time_in)}</span></div>
      <div className="student-session-clock"><span>{session.session_type === 'OPEN_TIME' && session.credit_cutoff_at ? 'Time elapsed' : 'Remaining session time'}</span><ServiceCountdown session={session} now={now}/></div>
    </article>)}
    {active.length > 0 && <p className="student-caption">Current session time is credited after staff records Time Out.</p>}
    {error && <p className="attendance-update-error" role="alert">{error}</p>}
  </section>
}
