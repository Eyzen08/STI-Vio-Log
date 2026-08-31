import { assignmentProgress, isVerifiedQr } from '../lib/departmentScanner.js'

function DepartmentQrScanner({ form, result, error, verifiedQr, isScanning, isSubmitting, onFieldChange, onStartCamera, onStopCamera, onAction }) {
  const verified = isVerifiedQr(form.qr_code, verifiedQr)
  const progress = assignmentProgress(result?.assignment)

  return (
    <section className="department-scanner" aria-labelledby="scanner-title">
      <header className="page-intro scanner-intro">
        <div>
          <p className="eyebrow">Community-service attendance</p>
          <h2 id="scanner-title">QR scanner</h2>
          <p>Verify the student and active assignment before recording attendance.</p>
        </div>
        <span className="profile-readonly-badge">Department scoped</span>
      </header>

      <div className="scanner-layout">
        <article className="scanner-card">
          <div className="scanner-camera">
            <div id="qr-reader" aria-label="Camera QR scanner" />
            {!isScanning
              ? <button type="button" onClick={onStartCamera} disabled={isSubmitting}>Start camera</button>
              : <button type="button" className="secondary" onClick={onStopCamera}>Stop camera</button>}
          </div>

          <div className="scanner-divider"><span>or enter code manually</span></div>
          <label className="scanner-field" htmlFor="department-qr-code">
            QR attendance code
            <input id="department-qr-code" type="text" name="qr_code" value={form.qr_code} onChange={onFieldChange}
              placeholder="Enter the code shown by the student" autoComplete="off" disabled={isSubmitting} />
          </label>
          <button type="button" className="scanner-verify" onClick={() => onAction('scan')}
            disabled={isSubmitting || !form.qr_code.trim()}>
            {isSubmitting ? 'Checking…' : 'Verify student'}
          </button>
          {error && <p className="error-message" role="alert">{error}</p>}
        </article>

        <article className="scanner-confirmation" aria-live="polite">
          {!verified || !result?.student ? (
            <div className="scanner-placeholder">
              <span aria-hidden="true">⌁</span>
              <h3>Waiting for verification</h3>
              <p>Scan or enter a code to review the student and assignment.</p>
            </div>
          ) : (
            <>
              <div className="verified-heading">
                <span aria-hidden="true">✓</span>
                <div><p className="eyebrow">Verified student</p><h3>{result.student.first_name} {result.student.last_name}</h3></div>
              </div>
              <dl className="verified-details">
                <div><dt>Student number</dt><dd>{result.student.student_number}</dd></div>
                <div><dt>Assignment</dt><dd>#{result.assignment?.id}</dd></div>
                <div><dt>Status</dt><dd>{result.assignment?.status?.replaceAll('_', ' ')}</dd></div>
                <div><dt>Remaining service</dt><dd>{progress.remaining.toFixed(2)} hrs</dd></div>
              </dl>
              <label className="scanner-field" htmlFor="attendance-notes">
                Service result note <span>(describe the student’s work or any concern)</span>
                <textarea id="attendance-notes" name="notes" value={form.notes} onChange={onFieldChange}
                  rows="3" maxLength="500" disabled={isSubmitting} />
              </label>
              <label className="scanner-field" htmlFor="service-condition">Student condition
                <select id="service-condition" name="condition" value={form.condition||''} onChange={onFieldChange} disabled={isSubmitting}>
                  <option value="">Select before time-out</option><option value="SATISFACTORY">Satisfactory</option><option value="NEEDS_FOLLOW_UP">Needs follow-up</option><option value="INCIDENT_REPORTED">Incident reported</option>
                </select>
              </label>
              <div className="attendance-actions">
                <button type="button" onClick={() => onAction('time-in')} disabled={isSubmitting}>Record time in</button>
                <button type="button" className="secondary" onClick={() => onAction('time-out')} disabled={isSubmitting||!form.condition}>Submit time out and result</button>
              </div>
              {result.action !== 'scan' && <p className="success-message" role="status">{result.message}</p>}
            </>
          )}
        </article>
      </div>
      <p className="scope-note">Your authenticated account determines the actor and department. Neither can be overridden by this form.</p>
    </section>
  )
}

export default DepartmentQrScanner
