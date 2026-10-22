import { useState } from 'react'
import { academicSummary } from '../lib/studentAcademic.js'
import { departmentTypeLabel } from '../lib/departmentAccounts.js'
import { assignmentProgress, formatServiceMinutes, isVerifiedQr } from '../lib/departmentScanner.js'
import { formatManilaDateTime, formatManilaTime, formatDisplayLabel } from '../lib/displayFormat.js'
import { formatLiveServiceTime, serviceSessionTiming } from '../lib/departmentService.js'
import useServiceClock from '../lib/useServiceClock.js'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import ServiceAttendanceControls from './ServiceAttendanceControls.jsx'
import ServicePauseHistory from './ServicePauseHistory.jsx'
import Modal from './Modal.jsx'
import '../styles/community-workflow.css'

export default function DepartmentQrScanner({ form, result, error, verifiedQr, inputSource='manual', isScanning, isSubmitting, recorder, history=[], historyError='', token, onFieldChange, onStartCamera, onStopCamera, onSwitchCamera, onAction, onAttendanceSaved }) {
  const [studentOpen,setStudentOpen] = useState(false)
  const verified=isVerifiedQr(form.qr_code,verifiedQr)&&Boolean(result?.student)
  const progress=assignmentProgress(result?.assignment)
  const session=result?.active_session || (result?.session?.status==='ACTIVE'?result.session:null)
  const clock=useServiceClock(result?.server_time)
  const now=clock ?? Date.now()
  const timing=session?serviceSessionTiming(session,now):null
  const allowance=result?.allowance||{}
  const available=Number(allowance.available_minutes||0)
  const officers=result?.available_officers||[]
  const noOfficer=verified&&officers.length===0
  const cameraAvailable=typeof window==='undefined'||(window.isSecureContext&&Boolean(navigator.mediaDevices?.getUserMedia))
  const eligibleMinutes=timing ? timing.elapsedSeconds/60 : 0
  const projectedMinutes=Math.min(progress.remaining*60,eligibleMinutes>=progress.remaining*60?eligibleMinutes:Math.floor(eligibleMinutes))
  return <section className="qr-attendance" aria-labelledby="qr-attendance-title">
    <header className="qr-attendance-header portal-page-header"><div><p className="page-breadcrumb">Home / QR Attendance</p><h2 id="qr-attendance-title">Time in / Time Out</h2><p>Scan, verify, and record attendance.</p></div><span className={'scanner-state'+(isScanning?' active':'')}><i aria-hidden="true"/>{isSubmitting?'Updating Attendance':isScanning?'Scanner Active':cameraAvailable?'Scanner Ready':'Manual Entry Available'}</span></header>
    <div className="qr-stage-grid">
      <article className="qr-stage-card scan-stage"><h3><b>1</b> Scan Student QR</h3>
        <div className={'scanner-viewfinder'+(isScanning?' active':'')}><div id="qr-reader" aria-label="Camera QR Scanner"/><div className="scanner-frame" aria-hidden="true"><span><PortalIcon name="camera" size={32}/></span><strong>{isScanning?'Position the student QR code inside the frame':'Camera preview is stopped'}</strong>{!isScanning&&<small>Click Start Camera to begin scanning</small>}</div><em>{isScanning?'Camera Active':cameraAvailable?'Camera Ready':'Manual QR Available'}</em></div>
        <div className="scanner-control-row">{isScanning?<button type="button" onClick={onStopCamera}><PortalIcon name="camera"/>Stop Camera</button>:<button type="button" onClick={onStartCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="play"/>Start Camera</button>}<button type="button" className="secondary-button" onClick={onSwitchCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="rotate"/>Switch Camera</button></div>
        <label className="qr-manual-field">{inputSource==='camera'?'Scanned QR Code':'Manual QR Code'}<div><span className="qr-manual-input"><PortalIcon name="qr"/><input name="qr_code" value={form.qr_code} onChange={onFieldChange} placeholder="Paste the student's attendance code" autoComplete="off" disabled={isSubmitting}/></span>{inputSource==='manual'&&<button type="button" onClick={()=>onAction('scan')} disabled={isSubmitting||!form.qr_code.trim()}>{isSubmitting?'Checking…':'Verify'}</button>}</div></label>
        {inputSource==='camera'&&<p className="field-help" role="status">{isSubmitting?'Verifying camera scan…':verified?'Camera scan verified automatically.':error?'Scan again or enter the code manually.':'Camera scans verify automatically.'}</p>}
        <p className="qr-security-note"><PortalIcon name="info" size={14}/>Only authorized staff can record attendance.</p>
      </article>
      <article className="qr-stage-card verify-stage" aria-live="polite"><h3><b>2</b> Student Verification</h3>{!verified?<div className="qr-empty-state"><span aria-hidden="true"><PortalIcon name="qr" size={28}/></span><strong>Waiting for Student QR</strong><p>Scan or manually enter a code to review the active assignment.</p></div>:<>
        <div className="verified-student"><Avatar identity={result.student}/><div><h4>{[result.student.first_name,result.student.middle_name,result.student.last_name,result.student.suffix].filter(Boolean).join(' ')}</h4><p>{result.student.student_number}</p><p>{academicSummary(result.student)}</p>{!result.student.section&&<p>Section not recorded</p>}</div><mark><PortalIcon name="check" size={20}/>Verified</mark></div>
        {result.assignments?.length>1&&!session&&<label>Community Service Requirement<select name="assignment_id" value={result.assignment?.id||''} onChange={onFieldChange} disabled={isSubmitting}><option value="">Select a Service Assignment</option>{result.assignments.map(item=><option key={item.id} value={item.id}>Assignment #{item.id} · {departmentTypeLabel(item)} · {formatServiceMinutes(Number(item.remaining_hours)*60)} Remaining</option>)}</select></label>}
        <section className="qr-assignment-card"><h4><PortalIcon name="registrations"/>Community Service Requirement</h4><p>{result.assignment?'Assignment #'+result.assignment.id+' · '+departmentTypeLabel(result.assignment):result.assignments?.length?'Select a service assignment':'No active service requirement in your authorized departments'}</p><dl className="assignment-summary"><div><dt>Required</dt><dd>{formatServiceMinutes(progress.required*60)}</dd></div><div><dt>Completed</dt><dd>{formatServiceMinutes(progress.completed*60)}</dd></div><div><dt>Remaining</dt><dd>{formatServiceMinutes(progress.remaining*60)}</dd></div></dl></section>
        <dl className="service-daily-summary"><div><dt>Daily Allowance Used</dt><dd>{formatServiceMinutes(allowance.completed_today_minutes)}</dd></div><div><dt>Daily Allowance Remaining</dt><dd>{formatServiceMinutes(allowance.daily_remaining_minutes)}</dd></div></dl><p className="attendance-state">{result.student_status}</p>
      </>}</article>
    </div>
    <article className="qr-stage-card record-stage"><h3><b>3</b> {session?'Active Service Session':'Record Attendance'}</h3>
      {error&&<p className="error-message" role="alert">{error}</p>}
      {!verified?<p className="qr-recent-empty">Verify a student to record attendance.</p>:result.active_session_elsewhere?<p className="error-message" role="alert">Active Service Session Found. This student is timed in with another department. Contact the supervising staff to record Time Out.</p>:session?<div className="service-active-panel">
        <div className="service-active-heading"><span className="scanner-state active"><i/>Already Timed In</span><strong>{session.session_type==='FIXED'?formatServiceMinutes(session.selected_duration_minutes)+' target':'Open Time Session'}</strong></div>
        <div className="service-active-clock"><span>{session.session_type==='FIXED'?'Time Remaining':'Time Elapsed'}</span><ServiceCountdown session={session} now={now} className="service-large-clock"/></div>
        <dl className="service-confirm-details"><div><dt>Time In</dt><dd>{formatManilaDateTime(session.time_in)}</dd></div><div><dt>{session.session_type==='FIXED'?'Expected Completion':'Credit Stops At'}</dt><dd>{formatManilaTime(session.session_type==='FIXED'?session.expected_completion_at:session.credit_cutoff_at)}</dd></div><div><dt>Available Service Time</dt><dd>{formatLiveServiceTime(timing.creditRemainingSeconds)}</dd></div><div><dt>Projected Total / Remaining</dt><dd>{formatServiceMinutes(progress.completed*60+projectedMinutes)} / {formatServiceMinutes(Math.max(0,progress.remaining*60-projectedMinutes))}</dd></div></dl>
        <p className="field-help">Current session time is credited only after Time Out is saved.</p><div className="service-confirm-actions"><button type="button" className="secondary-button" onClick={()=>setStudentOpen(true)}>View Student</button><ServiceAttendanceControls session={session} token={token} supervisingOfficerId={form.supervising_officer_id} initialNotes={form.notes} disabled={isSubmitting} onSaved={onAttendanceSaved}/></div>
      </div>:<>
        {result.assignment&&available>0?<>
          <div className="service-confirm-panel"><div className="record-fields"><label>Department<input readOnly value={departmentTypeLabel(result.assignment)}/></label><label>Supervising Officer<select name="supervising_officer_id" value={form.supervising_officer_id||''} onChange={onFieldChange} disabled={isSubmitting||officers.length<=1}><option value="">{noOfficer?'No Authorized Officer Available':'Select a Supervising Officer'}</option>{officers.map(officer=><option key={officer.officer_user_id} value={officer.officer_user_id}>{officer.first_name} {officer.last_name} · {formatDisplayLabel(officer.role)}</option>)}</select></label><label><span className="record-field-label">Attendance Note <small>Optional</small></span><input name="notes" maxLength="500" value={form.notes} onChange={onFieldChange} disabled={isSubmitting} placeholder="e.g. Assigned to organize library books."/></label></div>
            {noOfficer&&<p className="error-message">Contact the Discipline Office: no authorized officer is currently available.</p>}
            <p className="field-help">Service time counts while working. Pause for breaks and record Time Out when finished. Up to 8 hours can be credited per calendar day.</p>
            <div className="service-confirm-actions"><p className="field-help">Recorded By {recorder?.username||'authenticated staff'} · {formatDisplayLabel(recorder?.role)}</p><button type="button" onClick={()=>onAction('time-in')} disabled={!form.supervising_officer_id||noOfficer||isSubmitting}>{isSubmitting?'Recording…':'Confirm Time In'}</button></div>
          </div></>:<p className="service-timer-warning">{!result.assignment?(result.assignments?.length?'Select an eligible assignment to continue.':'Time In requires an active service assignment in your authorized departments.'):Number(allowance.daily_remaining_minutes)===0?'Daily Community Service Limit Reached. New service can begin tomorrow.':'No creditable service time remains.'}</p>}
      </>}
      {result?.action==='time-out'&&<p className="success-message" role="status">Time Out saved. {formatServiceMinutes(result.session?.credited_minutes)} credited.</p>}
    </article>
    {(history.length>0||historyError)&&<article className="qr-stage-card recent-stage"><h3>Community Service History</h3>{historyError&&<p className="service-timer-warning" role="status">{historyError}</p>}{history.length>0&&<div className="responsive-table"><table className="responsive-record-table"><thead><tr><th>Date / Department</th><th>Time in / Out</th><th>Mode / Target</th><th>Actual / Credited</th><th>Status</th><th>Authorized by / Notes</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td data-label="Date / Department">{formatManilaDateTime(item.time_in)}<small>{departmentTypeLabel(item)}</small></td><td data-label="Time in / Out">{formatManilaTime(item.time_in)} / {formatManilaTime(item.time_out)||'Active'}</td><td data-label="Mode / Target">{item.session_type==='FIXED'?formatServiceMinutes(item.selected_duration_minutes):item.session_type==='OPEN_TIME'?'Open Time':'Legacy Session'}</td><td data-label="Actual / Credited">{item.worked_minutes==null?'—':formatServiceMinutes(item.worked_minutes)} / {item.credited_minutes==null?'—':formatServiceMinutes(item.credited_minutes)}</td><td data-label="Status">{formatDisplayLabel(item.completion_reason||item.status)}</td><td data-label="Authorized by / Notes">{item.time_out_recorder_name||item.time_in_recorder_name||'Staff #'+(item.time_out_by_user_id||item.time_in_by_user_id)} · {formatDisplayLabel(item.time_out_role||item.time_in_role)}<small>{item.result_notes||item.notes||'—'}</small><ServicePauseHistory session={item}/></td></tr>)}</tbody></table></div>}</article>}
{studentOpen&&verified&&<Modal title="Student Information" onClose={()=>setStudentOpen(false)}><div className="verified-student"><Avatar identity={result.student}/><div><h3>{result.student.first_name} {result.student.last_name}</h3><p>{result.student.student_number}</p><p>{academicSummary(result.student)}</p>{result.assignment&&<p>{departmentTypeLabel(result.assignment)}</p>}<p>{result.student_status}</p></div></div></Modal>}
  </section>
}
