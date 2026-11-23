import { useEffect, useRef } from 'react'
import { academicLevelLabel, academicProgram, academicYear } from '../lib/studentAcademic.js'
import { formatIncidentDateTime } from '../lib/displayFormat.js'
import { formatPhilippinePhone } from '../lib/phone.js'
import AsyncActionButton from './AsyncActionButton.jsx'

const nameOf = (details) => [details.first_name, details.middle_name, details.last_name, details.suffix].filter(Boolean).join(' ')

export default function StudentAccountReview({ details, violationTypes = [], busy, error, onBack, onConfirm }) {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])
  const firstViolation = details.first_violation
  const violationType = firstViolation
    ? violationTypes.find((type) => Number(type.id) === Number(firstViolation.violation_type_id))
    : null
  return <section className="drawer-form-card student-account-review" aria-labelledby="student-account-review-title">
    <h3 id="student-account-review-title" ref={heading} tabIndex={-1}>Review Student Details</h3>
    <p>Check the official student information carefully before creating the account. Students cannot edit these details.</p>

    <section className="student-account-review-section" aria-labelledby="student-account-review-identity">
      <h4 id="student-account-review-identity">Student Identity</h4>
      <dl>
        <div><dt>Student Number</dt><dd>{details.student_number}</dd></div>
        <div><dt>Legal Name</dt><dd>{nameOf(details)}</dd></div>
        <div><dt>Student Gmail</dt><dd>{details.email}</dd></div>
      </dl>
    </section>

    <section className="student-account-review-section" aria-labelledby="student-account-review-academic">
      <h4 id="student-account-review-academic">Academic Information</h4>
      <dl>
        <div><dt>Academic Level</dt><dd>{academicLevelLabel(details)}</dd></div>
        <div><dt>Program / Strand</dt><dd>{academicProgram(details)}</dd></div>
        <div><dt>Year / Grade Level</dt><dd>{academicYear(details)}</dd></div>
        <div><dt>Section</dt><dd>{details.section}</dd></div>
      </dl>
    </section>

    <section className="student-account-review-section" aria-labelledby="student-account-review-contact">
      <h4 id="student-account-review-contact">Contact and Guardian</h4>
      <dl>
        <div><dt>Student Mobile Number</dt><dd>{formatPhilippinePhone(details.phone_number)}</dd></div>
        <div><dt>Guardian's Full Name</dt><dd>{details.guardian_name}</dd></div>
        <div><dt>Relationship to Student</dt><dd>{details.guardian_relationship}</dd></div>
        <div><dt>Guardian Mobile Number</dt><dd>{formatPhilippinePhone(details.guardian_phone_number)}</dd></div>
      </dl>
    </section>

    {firstViolation && <section className="student-account-review-section" aria-labelledby="student-account-review-violation">
      <h4 id="student-account-review-violation">First Violation</h4>
      <dl>
        <div><dt>Handbook Classification</dt><dd>{violationType ? `${violationType.violation_name} (${violationType.severity})` : `Classification #${firstViolation.violation_type_id}`}</dd></div>
        <div><dt>Incident</dt><dd>{formatIncidentDateTime(firstViolation.incident_date, firstViolation.incident_time)}</dd></div>
        <div><dt>Details</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{firstViolation.description}</dd></div>
      </dl>
      <p className="review-note">Community Service hours are assigned later by authorized staff.</p>
    </section>}

    <p>The account will be created after confirmation. You can send its temporary credentials from the next dialog.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    <form onSubmit={onConfirm} aria-busy={busy}><div className="create-record-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBack}>Back to Edit</button><AsyncActionButton type="submit" className="submit-btn" busy={busy} busyLabel="Creating Account…">Confirm and Create Account</AsyncActionButton></div></form>
  </section>
}
