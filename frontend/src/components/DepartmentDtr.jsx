import { useState } from 'react'
import { formatDuration } from '../lib/departmentDashboard.js'
import { departmentDtrSummary, displayDepartmentDtrDate } from '../lib/departmentDtr.js'
import { attendanceOutcomeLabel } from '../lib/attendanceOutcome.js'
import { formatDisplayLabel } from '../lib/displayFormat.js'
import ServiceHourCorrections from './ServiceHourCorrections.jsx'
import { ServiceDayInvalidationHistory } from './ServiceDayInvalidation.jsx'

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
          <p className="eyebrow">Department Records</p>
          <h2>Daily Time Record</h2>
          <p>Review community-service attendance recorded by your assigned department.</p>
        </div>
        <span>Service Dates</span>
      </section>

      <form className="department-dtr-filters" onSubmit={submit} aria-label="Filter Department DTR">
        <label><span id="department-dtr-from-label">From</span><input aria-labelledby="department-dtr-from-label" name="from" type="date" value={filters.from} onChange={update}  aria-describedby="department-dtr-date-help-1"/><small id="department-dtr-date-help-1">e.g. 1 Oct 2026.</small></label>
        <label><span id="department-dtr-to-label">To</span><input aria-labelledby="department-dtr-to-label" name="to" type="date" value={filters.to} onChange={update}  aria-describedby="department-dtr-date-help-2"/><small id="department-dtr-date-help-2">e.g. 12 Oct 2026.</small></label>
        <label><span id="department-dtr-student_id-label">Student ID</span><input aria-labelledby="department-dtr-student_id-label" name="student_id" inputMode="numeric" pattern="[0-9]*" value={filters.student_id} onChange={update} placeholder="e.g. 42"  aria-describedby="dtr-student-id-help"/><small id="dtr-student-id-help">Enter the student record ID, not the 11-digit student number. Leave blank to include all students.</small></label>
        <label><span id="department-dtr-assignment_id-label">Assignment ID</span><input aria-labelledby="department-dtr-assignment_id-label" name="assignment_id" inputMode="numeric" pattern="[0-9]*" value={filters.assignment_id} onChange={update} placeholder="e.g. 105"  aria-describedby="dtr-assignment-id-help"/><small id="dtr-assignment-id-help">Use the assignment ID shown in the service records. Leave blank to include all assignments.</small></label>
        <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply Filters'}</button>
      </form>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="department-metrics" aria-label="DTR Totals">
        <article className="stat-card"><span>Assignments</span><strong>{summary.records}</strong></article>
        <article className="stat-card"><span>Completed Sessions</span><strong>{summary.completedSessions}</strong></article>
        <article className="stat-card"><span>Worked Time</span><strong>{formatDuration(summary.workedMinutes)}</strong></article>
        <article className="stat-card"><span>Credited Time</span><strong>{formatDuration(summary.creditedMinutes)}</strong></article>
      </section>

      <section className="table-card dtr-card" aria-busy={loading}>
        <div className="table-header"><div><p className="eyebrow">Attendance Ledger</p><h3>Service Assignments</h3></div><span>{rows.length} records</span></div>
        {loading ? (
          <div className="department-empty" aria-live="polite"><p>Loading attendance records…</p></div>
        ) : rows.length === 0 ? (
          <div className="department-empty"><h4>{error ? 'Attendance Unavailable' : 'No Matching Attendance'}</h4><p>Try a wider date range or remove an ID filter.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="responsive-record-table department-dtr-table">
              <thead><tr><th>Student</th><th>Assignment & Status</th><th>Sessions & Outcome</th><th>Worked</th><th>Credited</th><th>Latest Attendance</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.assignment_id}-${row.department_id}`}>
                  <td data-label="Student"><strong>{row.first_name} {row.last_name}</strong><small className="table-subtext">{row.student_number}</small></td>
                  <td data-label="Assignment & Status"><strong>#{row.assignment_id}</strong><small><span className="status-badge">{formatDisplayLabel(row.assignment_status || 'UNKNOWN')}</span></small></td>
                  <td data-label="Sessions & Outcome"><strong>{row.total_completed_sessions}</strong><small>{attendanceOutcomeLabel(row.attendance_outcome)}</small></td><td data-label="Worked">{formatDuration(row.total_worked_minutes)}</td><td data-label="Credited">{formatDuration(row.total_credited_minutes)}</td>
                  <td data-label="Latest Attendance">{displayDepartmentDtrDate(row.latest_attendance_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <details className="department-corrections"><summary>Hour Corrections</summary><ServiceHourCorrections corrections={report?.hourCorrections || []}/></details>
      <ServiceDayInvalidationHistory invalidations={report?.dayInvalidations || []}/>
      <p className="scope-note">Department scope is derived from your authenticated account and cannot be changed here.</p>
    </div>
  )
}

export default DepartmentDtr
