import { formatDuration, summarizeDepartmentDtr } from '../lib/departmentDashboard.js'

const displayDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No attendance yet' : date.toLocaleString()
}

function DepartmentDashboard({ report, loading, error, onOpenScanner }) {
  const rows = Array.isArray(report?.data) ? report.data : []
  const summary = summarizeDepartmentDtr(report)
  const departmentName = rows[0]?.department_name || 'Your department'

  if (loading) {
    return (
      <section className="dashboard-loading" aria-live="polite">
        <div className="skeleton skeleton-heading" />
        <div className="stats-grid">
          {[1, 2, 3, 4].map((item) => <div className="stat-card skeleton-card" key={item} />)}
        </div>
      </section>
    )
  }

  return (
    <div className="department-dashboard">
      <section className="department-welcome">
        <div>
          <p className="eyebrow">Department operations</p>
          <h2>{departmentName}</h2>
          <p>Monitor community-service attendance recorded by your department.</p>
        </div>
        <button type="button" onClick={onOpenScanner}>Open QR scanner</button>
      </section>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="stats-grid department-stats" aria-label="Department attendance summary">
        <article className="stat-card"><span>Students served</span><strong>{summary.studentsServed}</strong></article>
        <article className="stat-card"><span>Active assignments</span><strong>{summary.activeAssignments}</strong></article>
        <article className="stat-card"><span>Completed sessions</span><strong>{summary.completedSessions}</strong></article>
        <article className="stat-card"><span>Credited service</span><strong>{formatDuration(summary.creditedMinutes)}</strong></article>
      </section>

      <section className="table-card department-activity">
        <div className="table-header">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Community-service progress</h3>
          </div>
          <span>{rows.length} {rows.length === 1 ? 'assignment' : 'assignments'}</span>
        </div>

        {rows.length === 0 ? (
          <div className="department-empty">
            <h4>No attendance recorded yet</h4>
            <p>Completed QR time-in and time-out sessions will appear here.</p>
          </div>
        ) : (
          <div className="department-record-list">
            {rows.slice(0, 6).map((row) => (
              <article key={`${row.assignment_id}-${row.department_id}`}>
                <div className="department-student">
                  <strong>{row.first_name} {row.last_name}</strong>
                  <span>{row.student_number}</span>
                </div>
                <dl>
                  <div><dt>Sessions</dt><dd>{row.total_completed_sessions}</dd></div>
                  <div><dt>Credited</dt><dd>{formatDuration(row.total_credited_minutes)}</dd></div>
                  <div><dt>Remaining</dt><dd>{Number(row.remaining_hours || 0).toFixed(2)} hrs</dd></div>
                </dl>
                <span className="department-latest">Latest: {displayDate(row.latest_attendance_at)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="scope-note">Dashboard data is restricted to attendance recorded in your assigned department.</p>
    </div>
  )
}

export default DepartmentDashboard
