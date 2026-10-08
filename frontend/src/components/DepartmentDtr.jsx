import { useState } from 'react'
import { formatDuration } from '../lib/departmentDashboard.js'
import { departmentDtrSummary, displayDepartmentDtrDate } from '../lib/departmentDtr.js'
import { attendanceOutcomeLabel } from '../lib/attendanceOutcome.js'
import { formatDisplayLabel } from '../lib/displayFormat.js'
import ServiceHourCorrections from './ServiceHourCorrections.jsx'

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
    <div className="department-dtr department-page">
      <section className="dtr-intro portal-page-header">
        <div>
          <p className="eyebrow">Department records</p>
          <h2>Daily Time Record</h2>
          <p>Review community-service attendance recorded by your assigned department.</p>
        </div>
        <span>Manila service dates</span>
      </section>

      <form className="department-dtr-filters" onSubmit={submit} aria-label="Filter department DTR">
        <label>From<input name="from" type="date" value={filters.from} onChange={update} /></label>
        <label>To<input name="to" type="date" value={filters.to} onChange={update} /></label>
        <label>Student ID<input name="student_id" inputMode="numeric" pattern="[0-9]*" value={filters.student_id} onChange={update} placeholder="All students" /></label>
        <label>Assignment ID<input name="assignment_id" inputMode="numeric" pattern="[0-9]*" value={filters.assignment_id} onChange={update} placeholder="All assignments" /></label>
        <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply filters'}</button>
      </form>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="department-metrics" aria-label="DTR totals">
        <article className="stat-card"><span>Assignments</span><strong>{summary.records}</strong></article>
        <article className="stat-card"><span>Completed sessions</span><strong>{summary.completedSessions}</strong></article>
        <article className="stat-card"><span>Worked time</span><strong>{formatDuration(summary.workedMinutes)}</strong></article>
        <article className="stat-card"><span>Credited time</span><strong>{formatDuration(summary.creditedMinutes)}</strong></article>
      </section>

      <section className="table-card dtr-card" aria-busy={loading}>
        <div className="table-header"><div><p className="eyebrow">Attendance Ledger</p><h3>Service Assignments</h3></div><span>{rows.length} records</span></div>
        {loading ? (
          <div className="department-empty" aria-live="polite"><p>Loading attendance records…</p></div>
        ) : rows.length === 0 ? (
          <div className="department-empty"><h4>{error ? 'Attendance unavailable' : 'No matching attendance'}</h4><p>Try a wider date range or remove an ID filter.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="responsive-record-table department-dtr-table">
              <thead><tr><th>Student</th><th>Assignment & status</th><th>Sessions & outcome</th><th>Worked</th><th>Credited</th><th>Latest attendance</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.assignment_id}-${row.department_id}`}>
                  <td data-label="Student"><strong>{row.first_name} {row.last_name}</strong><small className="table-subtext">{row.student_number}</small></td>
                  <td data-label="Assignment & status"><strong>#{row.assignment_id}</strong><small><span className="status-badge">{formatDisplayLabel(row.assignment_status || 'UNKNOWN')}</span></small></td>
                  <td data-label="Sessions & outcome"><strong>{row.total_completed_sessions}</strong><small>{attendanceOutcomeLabel(row.attendance_outcome)}</small></td><td data-label="Worked">{formatDuration(row.total_worked_minutes)}</td><td data-label="Credited">{formatDuration(row.total_credited_minutes)}</td>
                  <td data-label="Latest attendance">{displayDepartmentDtrDate(row.latest_attendance_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <details className="department-corrections"><summary>Hour corrections</summary><ServiceHourCorrections corrections={report?.hourCorrections || []}/></details>
      <p className="scope-note">Department scope is derived from your authenticated account and cannot be changed here.</p>
    </div>
  )
}

export default DepartmentDtr
