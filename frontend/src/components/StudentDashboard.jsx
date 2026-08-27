import { summarizeStudentDashboard } from '../lib/studentDashboard.js'

const formatHours = (hours) => Number(hours).toFixed(Number(hours) % 1 === 0 ? 0 : 2)

function StudentDashboard({
  profile,
  violations,
  assignments,
  clearanceRecords,
  eligibility,
  loading,
  error,
  onNavigate
}) {
  const summary = summarizeStudentDashboard({ violations, assignments, clearanceRecords, eligibility })
  const displayName = profile
    ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ')
    : 'Student'

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
    <div className="student-dashboard">
      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow">Student overview</p>
          <h2>Welcome back, {displayName}.</h2>
          <p>
            Review your current standing and take action on any outstanding requirements.
          </p>
        </div>
        {profile?.student_number && <span className="student-number">ID {profile.student_number}</span>}
      </section>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="stats-grid student-stats" aria-label="Student status summary">
        <article className="stat-card stat-card-featured">
          <span>Current standing</span>
          <strong>{summary.standing}</strong>
        </article>
        <article className="stat-card">
          <span>Active violations</span>
          <strong>{summary.activeViolations}</strong>
        </article>
        <article className="stat-card">
          <span>Service remaining</span>
          <strong>{formatHours(summary.remainingHours)} hrs</strong>
        </article>
        <article className="stat-card">
          <span>Clearance</span>
          <strong>{summary.clearanceStatus.replaceAll('_', ' ')}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="table-card dashboard-panel">
          <div className="table-header">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h3>Latest violations</h3>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('/student/violations')}>
              View all
            </button>
          </div>
          {violations.length === 0 ? (
            <p className="empty-state">No violations on record.</p>
          ) : (
            <ul className="activity-list">
              {violations.slice(0, 3).map((violation) => (
                <li key={violation.id}>
                  <div>
                    <strong>Violation #{violation.id}</strong>
                    <span>{new Date(violation.incident_date).toLocaleDateString()}</span>
                  </div>
                  <span className="status-badge">{violation.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="table-card dashboard-panel">
          <div className="table-header">
            <div>
              <p className="eyebrow">Next steps</p>
              <h3>Quick access</h3>
            </div>
          </div>
          <div className="quick-actions">
            <button type="button" onClick={() => onNavigate('/student/qr')}>
              <strong>My QR code</strong><span>Open attendance code</span>
            </button>
            <button type="button" onClick={() => onNavigate('/student/community-service')}>
              <strong>My service</strong><span>Review progress and DTR</span>
            </button>
            <button type="button" onClick={() => onNavigate('/student/profile')}>
              <strong>My profile</strong><span>Review student information</span>
            </button>
            <button type="button" onClick={() => onNavigate('/student/clearance')}>
              <strong>My clearance</strong><span>Check approval status</span>
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}

export default StudentDashboard
