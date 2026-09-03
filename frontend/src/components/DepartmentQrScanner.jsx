import { assignmentProgress, attendanceState, formatServiceMinutes, isVerifiedQr } from '../lib/departmentScanner.js'

const roleLabel=(role='')=>role.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,(letter)=>letter.toUpperCase())
const displayDate=(value)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'No activity recorded':date.toLocaleString()}

function DepartmentQrScanner({ form, result, error, verifiedQr, isScanning, isSubmitting, departments=[], recorder, recentScans=[], onFieldChange, onStartCamera, onStopCamera, onSwitchCamera, onAction }) {
  const verified=isVerifiedQr(form.qr_code,verifiedQr)&&Boolean(result?.student)
  const progress=assignmentProgress(result?.assignment)
  const percent=progress.required?Math.min(100,Math.round((progress.completed/progress.required)*100)):0
  const state=attendanceState(result?.assignment)
  const departmentLocked=recorder?.role==='DEPARTMENT_HEAD'

  return <section className="qr-attendance" aria-labelledby="qr-attendance-title">
    <header className="qr-attendance-header"><div><p className="eyebrow">Administration</p><h2 id="qr-attendance-title">QR Attendance</h2><p>Scan and verify a student before recording community-service attendance.</p></div><span className={`scanner-state${isScanning?' active':''}`}><i aria-hidden="true"/>{isScanning?'Scanner active':'Scanner ready'}</span></header>
    <div className="qr-stage-grid">
      <article className="qr-stage-card scan-stage"><h3><b>1</b> Scan Student QR</h3>
        <div className={`scanner-viewfinder${isScanning?' active':''}`}><div id="qr-reader" aria-label="Camera QR scanner"/><div className="scanner-frame" aria-hidden="true"><span/><strong>{isScanning?'Position the student QR code inside the frame':'Camera preview is stopped'}</strong></div><em>{isScanning?'Camera active':'Camera ready'}</em></div>
        <div className="scanner-control-row">{isScanning?<button type="button" onClick={onStopCamera}>Stop Camera</button>:<button type="button" onClick={onStartCamera} disabled={isSubmitting}>Start Camera</button>}<button type="button" className="secondary-button" onClick={onSwitchCamera} disabled={isSubmitting}>Switch Camera</button></div>
        <label className="qr-manual-field">Manual QR code<div><input name="qr_code" value={form.qr_code} onChange={onFieldChange} placeholder="Enter the student attendance code" autoComplete="off" disabled={isSubmitting}/><button type="button" onClick={()=>onAction('scan')} disabled={isSubmitting||!form.qr_code.trim()}>{isSubmitting?'Checking…':'Verify'}</button></div></label>
        {error&&<p className="error-message" role="alert">{error}</p>}<p className="qr-security-note">Only authorized staff can record attendance.</p>
      </article>
      <article className="qr-stage-card verify-stage" aria-live="polite"><h3><b>2</b> Student Verification</h3>{!verified?<div className="qr-empty-state"><span aria-hidden="true">⌁</span><strong>Waiting for student QR</strong><p>Scan or manually enter a code to review the active assignment.</p></div>:<>
        <div className="verified-student"><span aria-hidden="true">{result.student.first_name?.[0]}{result.student.last_name?.[0]}</span><div><h4>{result.student.first_name} {result.student.last_name}</h4><p>{result.student.student_number}</p><p>{[result.student.program,result.student.section,result.student.year_level&&`Year ${result.student.year_level}`].filter(Boolean).join(' · ')}</p></div><mark>Verified</mark></div>
        <dl className="assignment-summary"><div><dt>Assignment</dt><dd>{result.assignment.department_name||`#${result.assignment.id}`}</dd></div><div><dt>Required</dt><dd>{formatServiceMinutes(progress.required*60)}</dd></div><div><dt>Completed</dt><dd>{formatServiceMinutes(progress.completed*60)}</dd></div><div><dt>Remaining</dt><dd>{formatServiceMinutes(progress.remaining*60)}</dd></div></dl>
        <div className="assignment-progress"><span>Progress</span><progress max="100" value={percent}>{percent}%</progress><strong>{percent}%</strong></div><div className={`attendance-state ${state.active?'active':''}`}>{state.label}{state.active&&result.assignment.active_time_in?<small> since {displayDate(result.assignment.active_time_in)}</small>:null}</div><div className="last-attendance"><span>Last activity</span><strong>{displayDate(result.assignment.last_activity_at)}</strong></div>
      </>}</article>
    </div>
    <article className="qr-stage-card record-stage"><h3><b>3</b> Record Attendance</h3><div className="record-fields">
      <label>Department<select name="department_id" value={departmentLocked?(departments[0]?.id||''):form.department_id} onChange={onFieldChange} disabled={departmentLocked||isSubmitting} required><option value="">Select assigned department</option>{departments.map((department)=><option key={department.id} value={department.id}>{department.name}{department.code?` (${department.code})`:''}</option>)}</select></label>
      <label>Attendance note <span>(optional)</span><input name="notes" maxLength="500" value={form.notes} onChange={onFieldChange} placeholder="Add attendance note" disabled={isSubmitting}/></label>
      <label>Student service condition <span>(required before Time Out)</span><select name="condition" value={form.condition||''} onChange={onFieldChange} disabled={isSubmitting}><option value="">Select before Time Out</option><option value="SATISFACTORY">Satisfactory</option><option value="NEEDS_FOLLOW_UP">Needs follow-up</option><option value="INCIDENT_REPORTED">Incident reported</option></select></label>
    </div><div className="attendance-footer"><p><strong>Recorded as {recorder?.username||'authenticated staff'}</strong><span>{roleLabel(recorder?.role)} · Recorder and timestamps are set by the server.</span></p><div><button type="button" onClick={()=>onAction('time-in')} disabled={!verified||isSubmitting||state.active}>{isSubmitting?'Recording…':'Time In'}</button><button type="button" className="time-out-button" onClick={()=>onAction('time-out')} disabled={!verified||isSubmitting||!state.active||!form.condition}>{isSubmitting?'Recording…':'Time Out & Credit Hours'}</button></div></div>
      {result?.action!=='scan'&&result?.message?<p className="success-message" role="status">{result.message}{result.session?.credited_minutes!=null?` ${formatServiceMinutes(result.session.credited_minutes)} credited.`:''}</p>:null}
    </article>
    <article className="qr-stage-card recent-stage"><h3>Recent Scans</h3>{recentScans.length===0?<p className="qr-recent-empty">Attendance recorded during this session will appear here.</p>:<div className="responsive-table"><table><thead><tr><th>Student</th><th>Action</th><th>Time</th><th>Department</th><th>Result</th></tr></thead><tbody>{recentScans.map((scan)=><tr key={scan.key}><td><strong>{scan.studentName}</strong><span>{scan.studentNumber}</span></td><td>{scan.action}</td><td>{displayDate(scan.time)}</td><td>{scan.department}</td><td><span className="scan-success">Success</span></td></tr>)}</tbody></table></div>}</article>
  </section>
}

export default DepartmentQrScanner
