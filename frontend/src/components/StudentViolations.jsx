import { useState } from 'react'
import { formatHours, normalizeViolation, statusLabel } from '../lib/studentViolations.js'

const formatDate = (value, includeTime = false) => {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return includeTime ? date.toLocaleString() : date.toLocaleDateString()
}

function ServiceProgress({ violation }) {
  const required = violation.required_service_hours
  const completed = Math.min(violation.completed_service_hours, required || violation.completed_service_hours)
  const percentage = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 100

  return (
    <section className="service-progress" aria-label="Community service progress">
      <div className="service-progress-heading">
        <h4>Community service</h4>
        <span>{percentage}% complete</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <dl className="service-hours-grid">
        <div><dt>Required</dt><dd>{formatHours(required)} hrs</dd></div>
        <div><dt>Completed</dt><dd>{formatHours(completed)} hrs</dd></div>
        <div><dt>Remaining</dt><dd>{formatHours(violation.remaining_service_hours)} hrs</dd></div>
      </dl>
    </section>
  )
}

function StudentViolations({ violations, loading, error }) {
  const [expandedId, setExpandedId] = useState(null)
  const records = violations.map(normalizeViolation)

  if (loading) {
    return (
      <section className="violations-page" aria-live="polite">
        <div className="skeleton violations-heading-skeleton" />
        {[1, 2, 3].map((item) => <div className="skeleton violation-card-skeleton" key={item} />)}
      </section>
    )
  }

  return (
    <section className="violations-page" aria-labelledby="violations-title">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Disciplinary record</p>
          <h2 id="violations-title">My violations</h2>
          <p>Review your records, required service, and status history.</p>
        </div>
        <span className="record-count">{records.length} {records.length === 1 ? 'record' : 'records'}</span>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!error && records.length === 0 ? (
        <div className="violations-empty">
          <span aria-hidden="true">✓</span>
          <h3>No violations on record</h3>
          <p>Your student disciplinary record is currently clear.</p>
        </div>
      ) : (
        <div className="violation-list">
          {records.map((violation) => {
            const expanded = expandedId === violation.id
            const panelId = `violation-details-${violation.id}`
            return (
              <article className="violation-card" key={violation.id}>
                <button
                  className="violation-summary"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setExpandedId(expanded ? null : violation.id)}
                >
                  <div className="violation-summary-main">
                    <div className="violation-badges">
                      <span className={`severity-badge severity-${violation.severity.toLowerCase()}`}>{violation.severity}</span>
                      <span className={`status-badge status-${violation.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabel(violation.status)}</span>
                    </div>
                    <h3>{violation.violation_name}</h3>
                    <p>{violation.violation_code || `Record #${violation.id}`} · Incident {formatDate(violation.incident_date)}</p>
                  </div>
                  <span className="violation-toggle" aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>

                {expanded && (
                  <div className="violation-details" id={panelId}>
                    <div className="violation-description">
                      <h4>Details</h4>
                      <p>{violation.description || 'No additional description was provided.'}</p>
                    </div>

                    <ServiceProgress violation={violation} />

                    <section className="lifecycle-section" aria-labelledby={`history-title-${violation.id}`}>
                      <h4 id={`history-title-${violation.id}`}>Status history</h4>
                      {violation.history.length === 0 ? (
                        <p className="empty-state">No lifecycle events are available.</p>
                      ) : (
                        <ol className="timeline">
                          {violation.history.map((event) => (
                            <li key={event.id}>
                              <span className="timeline-marker" aria-hidden="true" />
                              <div>
                                <strong>{statusLabel(event.action)}</strong>
                                <span>{formatDate(event.created_at, true)} · {statusLabel(event.to_status)}</span>
                                {event.reason && <p>{event.reason}</p>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default StudentViolations
