import { useEffect, useRef } from 'react'
import AsyncActionButton from './AsyncActionButton.jsx'

export default function StudentAccountReview({ details, busy, error, onBack, onConfirm }) {
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="drawer-form-card student-account-review" aria-labelledby="student-account-review-title">
    <h3 id="student-account-review-title" ref={heading} tabIndex={-1}>Review student details</h3>
    <p>Check the school-issued Student Number, legal name, and Gmail carefully before creating the account.</p>
    <dl>{[['student_number','Student Number'],['first_name','First Name'],['last_name','Last Name'],['middle_name','Middle Name'],['suffix','Suffix'],['email','Student Gmail']].map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{details[key] || 'None'}</dd></div>)}</dl>
    <p>The account will be created after confirmation. You can send its temporary credentials from the next dialog.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    <form onSubmit={onConfirm} aria-busy={busy}><div className="create-record-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBack}>Back to Edit</button><AsyncActionButton type="submit" className="submit-btn" busy={busy} busyLabel="Creating account…">Confirm and Create Account</AsyncActionButton></div></form>
  </section>
}
