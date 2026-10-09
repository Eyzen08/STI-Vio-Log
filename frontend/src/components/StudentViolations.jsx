import { useState } from 'react'
import { notificationTarget } from '../lib/studentNotifications.js'
import RecordTargetFocus from './RecordTargetFocus.jsx'
import PortalIcon from './PortalIcon.jsx'
import { normalizeViolation, statusLabel } from '../lib/studentViolations.js'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime, formatManilaDate, formatManilaDateTime } from '../lib/displayFormat.js'
import { parseViolationDescription } from '../lib/violationAdmin.js'
import '../styles/student-portal.css'

const formatDate = (value, includeTime = false) => {
  if (!value) return 'Not recorded'
  return includeTime ? formatManilaDateTime(value) : formatManilaDate(value)
}

function ServiceProgress({ violation }) {
  const required = violation.required_service_hours
  const completed = Math.min(violation.completed_service_hours, required || violation.completed_service_hours)
  const percentage = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 100

  return (
    <section className="service-progress" aria-label="Community service progress">
      <div className="service-progress-heading">
        <h4>Community Service</h4>
        <span>{percentage}% complete</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <dl className="service-hours-grid">
        <div><dt>Required</dt><dd>{formatDuration(required)}</dd></div>
        <div><dt>Completed</dt><dd>{formatDuration(completed)}</dd></div>
        <div><dt>Remaining</dt><dd>{formatDuration(violation.remaining_service_hours)}</dd></div>
      </dl>
    </section>
  )
}

function StudentViolations({ violations, loading, error, searchParams = '', onCloseTarget, onOpenTarget }) {
  const target = notificationTarget(searchParams)
  const [expandedId, setExpandedId] = useState(target.invalid ? null : target.violationId || null)
  const records = violations.map(normalizeViolation)

  if (loading) {
    return (
      <section className="student-page violations-page" aria-live="polite">
        <div className="skeleton violations-heading-skeleton" />
        {[1, 2, 3].map((item) => <div className="skeleton violation-card-skeleton" key={item} />)}
      </section>
    )
  }

  return (
    <section className="student-page violations-page" aria-labelledby="violations-title">
      <RecordTargetFocus id={!target.invalid && target.violationId ? `violation-record-${target.violationId}` : null} loading={loading} error={error} />
      <header className="page-intro portal-page-header">
        <div>
          <h2 id="violations-title">My Violations</h2>
          <p>Review your records, required service, and status history.</p>
        </div>
        <span className="record-count">{records.length} {records.length === 1 ? 'record' : 'records'}</span>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      {!error && records.length === 0 ? (
        <div className="violations-empty">
          <span aria-hidden="true">✓</span>
          <h3>No Violations on Record</h3>
          <p>Your student disciplinary record is currently clear.</p>
        </div>
      ) : (
        <div className="violation-list">
          {records.map((violation) => {
            const expanded = String(expandedId) === String(violation.id)
            const panelId = `violation-details-${violation.id}`
            const parsed = parseViolationDescription(violation.description || '')
            const offense = violation.exact_offense || parsed.exact_offense || violation.violation_name
            const notes = violation.incident_details || parsed.incident_details
            const distinctNotes = notes?.trim() && notes.trim().toLowerCase() !== offense.trim().toLowerCase() ? notes : ''
            return (
              <article className="violation-card" key={violation.id} id={`violation-record-${violation.id}`} tabIndex={-1}>
                <button
                  className="violation-summary"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => {
                    setExpandedId(expanded ? null : violation.id)
                    if (expanded && target.violationId === String(violation.id)) onCloseTarget?.()
                    else if (!expanded) onOpenTarget?.(violation.id)
                  }}
                >
                  <div className="violation-summary-main">
                    <div className="violation-badges">
                      <span className={`severity-badge severity-${violation.severity.toLowerCase()}`}>{formatDisplayLabel(violation.severity)}</span>
                      <span className={`status-badge status-${violation.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabel(violation.status)}</span>
                    </div>
                    <h3>{offense}</h3>
                    {violation.violation_name !== offense && <p>{violation.violation_name}</p>}
                    <p>Record #{violation.id}{violation.violation_code && ` · ${violation.violation_code}`} · {formatIncidentDateTime(violation.incident_date, violation.incident_time)}</p>
                  </div>
                  <span className="violation-toggle" aria-hidden="true"><PortalIcon name="chevron-right" className="violation-chevron" size={20} /></span>
                </button>

                {expanded && (
                  <div className="violation-details" id={panelId}>
                    {distinctNotes && <div className="violation-description"><h4>Incident notes</h4><p>{distinctNotes}</p></div>}

                    <ServiceProgress violation={violation} />

                    <section className="lifecycle-section" aria-labelledby={`history-title-${violation.id}`}>
                      <h4 id={`history-title-${violation.id}`}>Status History</h4>
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
