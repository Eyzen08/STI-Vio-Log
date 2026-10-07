import { academicSummary } from '../lib/studentAcademic.js'
import { assignmentProgress, attendanceState, formatServiceMinutes, isVerifiedQr } from '../lib/departmentScanner.js'
import { formatDisplayLabel, formatManilaDateTime } from '../lib/displayFormat.js'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import '../styles/community-workflow.css'

const roleLabel=(role='')=>formatDisplayLabel(role)
const displayDate=(value)=>formatManilaDateTime(value,'No activity recorded')
const officerName=(officer)=>`${officer?.first_name||''} ${officer?.last_name||''}`.trim()||'Officer'

function DepartmentQrScanner({ form, result, error, verifiedQr, isScanning, isSubmitting, departments=[], recorder, recentScans=[], onFieldChange, onStartCamera, onStopCamera, onSwitchCamera, onAction }) {
  const verified=isVerifiedQr(form.qr_code,verifiedQr)&&Boolean(result?.student)
  const progress=assignmentProgress(result?.assignment)
  const percent=progress.required?Math.min(100,Math.round((progress.completed/progress.required)*100)):0
  const state=attendanceState(result?.assignment)
  const departmentLocked=recorder?.role==='DEPARTMENT_HEAD'
  const officers=result?.available_officers||[]
  const noOfficer=verified&&officers.length===0
  const cameraAvailable=typeof window==='undefined'||(window.isSecureContext&&Boolean(navigator.mediaDevices?.getUserMedia))

  return <section className="qr-attendance" aria-labelledby="qr-attendance-title">
    <header className="qr-attendance-header portal-page-header"><div><p className="page-breadcrumb">Home / QR Attendance</p><h2 id="qr-attendance-title">QR Attendance</h2><p>Scan a student QR to verify automatically, then record Time In or Time Out.</p></div><span className={`scanner-state${isScanning?' active':''}`}><i aria-hidden="true"/>{isSubmitting?'Updating attendance':isScanning?'Scanner active':cameraAvailable?'Scanner ready':'Manual entry available'}</span></header>
    <div className="qr-stage-grid">
      <article className="qr-stage-card scan-stage"><h3><b>1</b> Scan Student QR</h3>
        <div className={`scanner-viewfinder${isScanning?' active':''}`}><div id="qr-reader" aria-label="Camera QR scanner"/><div className="scanner-frame" aria-hidden="true"><span><PortalIcon name="camera" size={32}/></span><strong>{isScanning?'Position the student QR code inside the frame':'Camera preview is stopped'}</strong>{!isScanning&&<small>Click Start Camera to begin scanning</small>}</div><em>{isScanning?'Camera active':cameraAvailable?'Camera ready':'Manual QR available'}</em></div>
        <div className="scanner-control-row">{isScanning?<button type="button" onClick={onStopCamera}><PortalIcon name="camera"/>Stop Camera</button>:<button type="button" onClick={onStartCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="play"/>Start Camera</button>}<button type="button" className="secondary-button" onClick={onSwitchCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="rotate"/>Switch Camera</button></div>
        <label className="qr-manual-field">Manual QR code<div><span className="qr-manual-input"><PortalIcon name="qr"/><input name="qr_code" value={form.qr_code} onChange={onFieldChange} placeholder="Enter the student attendance code" autoComplete="off" disabled={isSubmitting}/></span><button type="button" onClick={()=>onAction('scan')} disabled={isSubmitting||!form.qr_code.trim()}>{isSubmitting?'Checking...':'Verify'}</button></div></label>
        <p className="qr-security-note"><PortalIcon name="info" size={14}/>Only authorized staff can record attendance.</p>
      </article>
      <article className="qr-stage-card verify-stage" aria-live="polite"><h3><b>2</b> Student Verification</h3>{!verified?<div className="qr-empty-state"><span aria-hidden="true"><PortalIcon name="qr" size={28}/></span><strong>Waiting for student QR</strong><p>Scan or manually enter a code to review the active assignment.</p></div>:<>
        <div className="verified-student"><Avatar identity={result.student}/><div><h4>{result.student.first_name} {result.student.last_name}</h4><p>{result.student.student_number}</p><p>{academicSummary(result.student)}</p></div><mark><PortalIcon name="check" size={20}/>Verified</mark></div>
        <section className="qr-assignment-card"><h4><PortalIcon name="registrations"/>Community Service Assignment</h4><dl className="assignment-summary"><div><dt>Assignment</dt><dd>{result.assignment.department_name||`#${result.assignment.id}`}</dd></div><div><dt>Required</dt><dd>{formatServiceMinutes(progress.required*60)}</dd></div><div><dt>Completed</dt><dd>{formatServiceMinutes(progress.completed*60)}</dd></div><div><dt>Remaining</dt><dd>{formatServiceMinutes(progress.remaining*60)}</dd></div></dl></section>
        <div className="assignment-progress"><span>Progress</span><progress aria-label="Completed service progress" max="100" value={percent}>{percent}%</progress><strong>{percent}%</strong></div><div className={`attendance-state ${state.active?'active':''}`}><PortalIcon name="clock"/>{state.label}{state.active&&result.assignment.active_time_in?<small> since {displayDate(result.assignment.active_time_in)}</small>:null}</div><div className="last-attendance"><span><PortalIcon name="calendar"/>Last activity</span><strong>{displayDate(result.assignment.last_activity_at)}</strong></div>
      </>}</article>
    </div>
    <article className="qr-stage-card record-stage"><h3><b>3</b> Record Attendance</h3><div className={`record-fields ${departmentLocked?'record-fields--scoped':'record-fields--admin'}`}>
      {!departmentLocked&&<label><span className="record-field-label">Department</span><select name="department_id" value={form.department_id} onChange={onFieldChange} disabled={isSubmitting} required><option value="">Select assigned department</option>{departments.map((department)=><option key={department.id} value={department.id}>{department.name}{department.code?` (${department.code})`:''}</option>)}</select></label>}
      <label><span className="record-field-label">Supervising officer</span><select name="supervising_officer_id" value={form.supervising_officer_id||''} onChange={onFieldChange} disabled={!verified||isSubmitting||officers.length<=1} required><option value="">{noOfficer?'No authorized officer available':'Select supervising officer'}</option>{officers.map((officer)=><option key={officer.officer_user_id} value={officer.officer_user_id}>{officerName(officer)} · {roleLabel(officer.role)} · {officer.availability_status}</option>)}</select>{noOfficer&&<span className="field-help field-help--error" role="alert">Contact the Discipline Office before recording attendance.</span>}</label>
      <label><span className="record-field-label">Attendance note <small>Optional</small></span><input name="notes" maxLength="500" value={form.notes} onChange={onFieldChange} placeholder="Add attendance note" disabled={isSubmitting}/></label>
      <label><span className="record-field-label">Attendance Outcome <small>Required before Time Out</small></span><select name="attendance_outcome" value={form.attendance_outcome||''} onChange={onFieldChange} disabled={isSubmitting}><option value="">Select Outcome</option><option value="TODAYS_SERVICE_COMPLETED">Today’s Service Completed</option><option value="LEFT_EARLY">Left Early</option><option value="SERVICE_COMPLETED">Service Completed</option></select></label>
    </div><div className="attendance-footer"><p><PortalIcon name="user"/><strong>Recorded as {recorder?.username||'authenticated staff'}</strong><span>{roleLabel(recorder?.role)} · Recorder and timestamps are set by the server.</span></p><div><button type="button" onClick={()=>onAction('time-in')} disabled={!verified||isSubmitting||state.active||!form.supervising_officer_id||noOfficer}><PortalIcon name="clock"/>{isSubmitting?'Recording...':'Time In'}</button><button type="button" className="time-out-button" onClick={()=>onAction('time-out')} disabled={!verified||isSubmitting||!state.active||!form.attendance_outcome||!form.supervising_officer_id||noOfficer}><PortalIcon name="logout"/>{isSubmitting?'Recording...':'Time Out & Credit Hours'}</button></div></div>
      {error&&<p className="error-message" role="alert">{error}</p>}{!error&&result?.action!=='scan'&&result?.message?<p className="success-message" role="status"><PortalIcon name="check"/>{result.message}{result.session?.credited_minutes!=null?` ${formatServiceMinutes(result.session.credited_minutes)} credited.`:''}</p>:null}
    </article>
    <article className="qr-stage-card recent-stage"><h3><i><PortalIcon name="registrations"/></i>Recent Scans</h3>{recentScans.length===0?<p className="qr-recent-empty">No QR attendance activity yet.</p>:<div className="responsive-table"><table className="responsive-record-table"><thead><tr><th>Student</th><th>Action</th><th>Time</th><th>Department</th><th>Result</th></tr></thead><tbody>{recentScans.map((scan)=><tr key={scan.key}><td data-label="Student"><Avatar identity={{name:scan.studentName}}/><div><strong>{scan.studentName}</strong><span>{scan.studentNumber}</span></div></td><td data-label="Action">{scan.action}</td><td data-label="Time">{displayDate(scan.time)}</td><td data-label="Department">{scan.department}</td><td data-label="Result"><span className="scan-success">Success</span></td></tr>)}</tbody></table></div>}</article>
  </section>
}

export default DepartmentQrScanner
