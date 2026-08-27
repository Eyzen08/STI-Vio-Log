import { useState } from 'react'
import { formatDuration } from '../lib/departmentDashboard.js'
import { departmentDtrSummary, displayDepartmentDtrDate } from '../lib/departmentDtr.js'

function DepartmentDtr({ report, loading, error, onFilter }) {
  const [filters, setFilters] = useState({ from: '', to: '', student_id: '', assignment_id: '' })
  const rows = Array.isArray(report?.data) ? report.data : []
  const summary = departmentDtrSummary(report)

  const submit = (event) => {
    event.preventDefault()
    onFilter(filters)
  }

  const update = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <div className="department-dtr">
      <section className="dtr-intro">
        <div>
          <p className="eyebrow">Department records</p>
          <h2>Daily time record</h2>
          <p>Review community-service attendance recorded by your assigned department.</p>
        </div>
        <span>UTC reporting</span>
      </section>

      <form className="department-dtr-filters" onSubmit={submit} aria-label="Filter department DTR">
        <label>From<input name="from" type="date" value={filters.from} onChange={update} /></label>
        <label>To<input name="to" type="date" value={filters.to} onChange={update} /></label>
        <label>Student ID<input name="student_id" inputMode="numeric" pattern="[0-9]*" value={filters.student_id} onChange={update} placeholder="All students" /></label>
        <label>Assignment ID<input name="assignment_id" inputMode="numeric" pattern="[0-9]*" value={filters.assignment_id} onChange={update} placeholder="All assignments" /></label>
        <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply filters'}</button>
      </form>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="stats-grid department-stats" aria-label="DTR totals">
        <article className="stat-card"><span>Assignments</span><strong>{summary.records}</strong></article>
        <article className="stat-card"><span>Completed sessions</span><strong>{summary.completedSessions}</strong></article>
        <article className="stat-card"><span>Worked time</span><strong>{formatDuration(summary.workedMinutes)}</strong></article>
        <article className="stat-card"><span>Credited time</span><strong>{formatDuration(summary.creditedMinutes)}</strong></article>
      </section>

      <section className="table-card dtr-card" aria-busy={loading}>
        <div className="table-header"><div><p className="eyebrow">Attendance ledger</p><h3>Service assignments</h3></div><span>{rows.length} records</span></div>
        {loading ? (
          <div className="department-empty" aria-live="polite"><p>Loading attendance records…</p></div>
        ) : rows.length === 0 ? (
          <div className="department-empty"><h4>No matching attendance</h4><p>Try a wider date range or remove an ID filter.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Assignment</th><th>Status</th><th>Sessions</th><th>Worked</th><th>Credited</th><th>Latest attendance</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.assignment_id}-${row.department_id}`}>
                  <td><strong>{row.first_name} {row.last_name}</strong><small className="table-subtext">{row.student_number}</small></td>
                  <td>#{row.assignment_id}</td><td><span className="status-badge">{String(row.assignment_status || 'UNKNOWN').replaceAll('_', ' ')}</span></td>
                  <td>{row.total_completed_sessions}</td><td>{formatDuration(row.total_worked_minutes)}</td><td>{formatDuration(row.total_credited_minutes)}</td>
                  <td>{displayDepartmentDtrDate(row.latest_attendance_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className="scope-note">Department scope is derived from your authenticated account and cannot be changed here.</p>
    </div>
  )
}

export default DepartmentDtr
