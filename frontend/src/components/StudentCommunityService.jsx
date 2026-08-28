import { useState } from 'react'
import { formatMinutes, summarizeStudentService, validateDateRange } from '../lib/studentService.js'

const dateTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function StudentCommunityService({ dtr, loading, error, onFilter }) {
  const [filters, setFilters] = useState({ from: '', to: '' })
  const [filterError, setFilterError] = useState('')
  const summary = summarizeStudentService(dtr)
  const assignments = Array.isArray(dtr?.assignments) ? dtr.assignments : []
  const sessions = Array.isArray(dtr?.sessions) ? dtr.sessions : []

  const submitFilters = (event) => {
    event.preventDefault()
    const validationError = validateDateRange(filters)
    setFilterError(validationError)
    if (!validationError) onFilter(filters)
  }

  if (loading && !dtr) {
    return <section className="service-page" aria-live="polite"><div className="skeleton service-heading-skeleton" /><div className="stats-grid">{[1, 2, 3].map((item) => <div className="stat-card skeleton-card" key={item} />)}</div></section>
  }

  return (
    <section className="service-page" aria-labelledby="service-title">
      <header className="page-intro">
        <div><p className="eyebrow">Community service</p><h2 id="service-title">My service and DTR</h2><p>Track assigned hours and authoritative attendance sessions.</p></div>
        <span className="record-count">UTC records</span>
      </header>

      {(error || filterError) && <p className="error-message" role="alert">{filterError || error}</p>}

      <section className="stats-grid service-stats" aria-label="Community-service summary">
        <article className="stat-card"><span>Required</span><strong>{formatMinutes(summary.requiredMinutes)}</strong></article>
        <article className="stat-card stat-card-featured"><span>Credited</span><strong>{formatMinutes(summary.creditedMinutes)}</strong></article>
        <article className="stat-card"><span>Remaining</span><strong>{formatMinutes(summary.remainingMinutes)}</strong></article>
        <article className="stat-card"><span>Completed sessions</span><strong>{summary.completedSessions}</strong></article>
      </section>

      <section className="table-card service-assignments">
        <div className="table-header"><h3>Assignments</h3><span>{assignments.length} records</span></div>
        {assignments.length === 0 ? <p className="empty-state">No community-service assignments.</p> : (
          <div className="assignment-list">{assignments.map((assignment) => {
            const required = Number(assignment.required_minutes) || 0
            const credited = Number(assignment.credited_minutes) || 0
            const percentage = required ? Math.min(100, Math.round((credited / required) * 100)) : 100
            return <article key={assignment.assignment_id}>
              <div><strong>{assignment.department_name || `Assignment #${assignment.assignment_id}`}</strong><span>Violation #{assignment.violation_id}</span><span>{assignment.department_head_first_name || assignment.department_head_last_name ? `Department Head: ${assignment.department_head_first_name || ''} ${assignment.department_head_last_name || ''}`.trim() : 'Department Head not recorded'}</span></div>
              <div className="assignment-progress"><div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div><small>{percentage}% complete</small></div>
              <span className="status-badge">{String(assignment.status).replaceAll('_', ' ')}</span>
            </article>
          })}</div>
        )}
      </section>

      <section className="table-card dtr-card">
        <div className="dtr-heading">
          <div><p className="eyebrow">Digital time record</p><h3>Attendance sessions</h3></div>
          <form className="dtr-filters" onSubmit={submitFilters}>
            <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
            <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
            <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
          </form>
        </div>
        {sessions.length === 0 ? <p className="empty-state">No attendance sessions match this period.</p> : (
          <div className="session-list">{sessions.map((session) => <article key={session.id}>
            <div><strong>{session.department_name}</strong><span>Assignment #{session.assignment_id}</span></div>
            <dl><div><dt>Time in</dt><dd>{dateTime(session.time_in)}</dd></div><div><dt>Time out</dt><dd>{dateTime(session.time_out)}</dd></div><div><dt>Worked</dt><dd>{session.worked_minutes == null ? 'In progress' : formatMinutes(session.worked_minutes)}</dd></div><div><dt>Credited</dt><dd>{session.credited_minutes == null ? '—' : formatMinutes(session.credited_minutes)}</dd></div></dl>
            <span className={`status-badge status-${String(session.status).toLowerCase()}`}>{session.status}</span>
          </article>)}</div>
        )}
      </section>
    </section>
  )
}

export default StudentCommunityService
