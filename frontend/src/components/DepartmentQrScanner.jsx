import { useState } from 'react'
import { academicSummary } from '../lib/studentAcademic.js'
import { assignmentProgress, formatServiceMinutes, isVerifiedQr } from '../lib/departmentScanner.js'
import { formatManilaDateTime, formatManilaTime, formatDisplayLabel } from '../lib/displayFormat.js'
import { formatLiveServiceTime, serviceSessionTiming } from '../lib/departmentService.js'
import useServiceClock from '../lib/useServiceClock.js'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import ServiceCountdown from './ServiceCountdown.jsx'
import ServiceTimeOutDialog from './ServiceTimeOutDialog.jsx'
import Modal from './Modal.jsx'
import '../styles/community-workflow.css'

export default function DepartmentQrScanner({ form, result, error, verifiedQr, isScanning, isSubmitting, recorder, history=[], token, onFieldChange, onStartCamera, onStopCamera, onSwitchCamera, onAction, onAttendanceSaved }) {
  const [studentOpen,setStudentOpen] = useState(false)
  const [timeOutOpen,setTimeOutOpen] = useState(false)
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
  const selected=form.session_type==='OPEN_TIME'?null:Number(form.selected_duration_minutes)
  const selectedValid=form.session_type==='OPEN_TIME'?available>0:form.session_type==='FIXED'&&selected>0&&selected<=available
  const cameraAvailable=typeof window==='undefined'||(window.isSecureContext&&Boolean(navigator.mediaDevices?.getUserMedia))
  const choose=(mode,minutes)=>onFieldChange({target:{name:'service_selection',value:{session_type:mode,selected_duration_minutes:minutes}}})
  const preset=(minutes,label,caption)=> {
    const disabled=minutes>available || (available<120&&minutes>=120)
    const id='duration-'+minutes
    return <div key={minutes}><button type="button" className={'service-duration-tile'+(form.session_type==='FIXED'&&selected===minutes?' selected':'')} onClick={()=>choose('FIXED',minutes)} disabled={disabled||isSubmitting} aria-pressed={form.session_type==='FIXED'&&selected===minutes} aria-describedby={disabled?id:undefined}><strong>{label}</strong>{caption&&<small>{caption}</small>}</button>{disabled&&<small id={id} className="duration-disabled-reason">Exceeds available service time.</small>}</div>
  }
  const eligibleMinutes=session?Math.max(0,(Math.min(now,new Date(session.credit_cutoff_at).getTime())-new Date(session.time_in).getTime())/60000):0
  const projectedMinutes=Math.min(progress.remaining*60,eligibleMinutes>=progress.remaining*60?eligibleMinutes:Math.floor(eligibleMinutes))
  return <section className="qr-attendance" aria-labelledby="qr-attendance-title">
    <header className="qr-attendance-header portal-page-header"><div><p className="page-breadcrumb">Home / QR Attendance</p><h2 id="qr-attendance-title">Time In / Time Out</h2><p>Scan, verify, select service time, and record attendance.</p></div><span className={'scanner-state'+(isScanning?' active':'')}><i aria-hidden="true"/>{isSubmitting?'Updating attendance':isScanning?'Scanner active':cameraAvailable?'Scanner ready':'Manual entry available'}</span></header>
    <div className="qr-stage-grid">
      <article className="qr-stage-card scan-stage"><h3><b>1</b> Scan Student QR</h3>
        <div className={'scanner-viewfinder'+(isScanning?' active':'')}><div id="qr-reader" aria-label="Camera QR scanner"/><div className="scanner-frame" aria-hidden="true"><span><PortalIcon name="camera" size={32}/></span><strong>{isScanning?'Position the student QR code inside the frame':'Camera preview is stopped'}</strong>{!isScanning&&<small>Click Start Camera to begin scanning</small>}</div><em>{isScanning?'Camera active':cameraAvailable?'Camera ready':'Manual QR available'}</em></div>
        <div className="scanner-control-row">{isScanning?<button type="button" onClick={onStopCamera}><PortalIcon name="camera"/>Stop Camera</button>:<button type="button" onClick={onStartCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="play"/>Start Camera</button>}<button type="button" className="secondary-button" onClick={onSwitchCamera} disabled={isSubmitting||!cameraAvailable}><PortalIcon name="rotate"/>Switch Camera</button></div>
        <label className="qr-manual-field">Manual QR code<div><span className="qr-manual-input"><PortalIcon name="qr"/><input name="qr_code" value={form.qr_code} onChange={onFieldChange} placeholder="Enter the student attendance code" autoComplete="off" disabled={isSubmitting}/></span><button type="button" onClick={()=>onAction('scan')} disabled={isSubmitting||!form.qr_code.trim()}>{isSubmitting?'Checking…':'Verify'}</button></div></label>
        <p className="qr-security-note"><PortalIcon name="info" size={14}/>Only authorized staff can record attendance.</p>
      </article>
      <article className="qr-stage-card verify-stage" aria-live="polite"><h3><b>2</b> Student Verification</h3>{!verified?<div className="qr-empty-state"><span aria-hidden="true"><PortalIcon name="qr" size={28}/></span><strong>Waiting for student QR</strong><p>Scan or manually enter a code to review the active assignment.</p></div>:<>
        <div className="verified-student"><Avatar identity={result.student}/><div><h4>{[result.student.first_name,result.student.middle_name,result.student.last_name,result.student.suffix].filter(Boolean).join(' ')}</h4><p>{result.student.student_number}</p><p>{academicSummary(result.student)}</p><p>{result.student.section||'Section not recorded'}</p></div><mark><PortalIcon name="check" size={20}/>Verified</mark></div>
        {result.assignments?.length>1&&!session&&<label>Community service requirement<select name="assignment_id" value={result.assignment?.id||''} onChange={onFieldChange} disabled={isSubmitting}><option value="">Select an assignment</option>{result.assignments.map(item=><option key={item.id} value={item.id}>Assignment #{item.id} · {item.department_name} · {formatServiceMinutes(Number(item.remaining_hours)*60)} remaining</option>)}</select></label>}
        <section className="qr-assignment-card"><h4><PortalIcon name="registrations"/>Community Service Requirement</h4><p>{result.assignment?'Assignment #'+result.assignment.id+' · '+result.assignment.department_name:'No assignment selected'}</p><dl className="assignment-summary"><div><dt>Required</dt><dd>{formatServiceMinutes(progress.required*60)}</dd></div><div><dt>Completed</dt><dd>{formatServiceMinutes(progress.completed*60)}</dd></div><div><dt>Remaining</dt><dd>{formatServiceMinutes(progress.remaining*60)}</dd></div></dl></section>
        <dl className="service-daily-summary"><div><dt>Completed today</dt><dd>{formatServiceMinutes(allowance.completed_today_minutes)}</dd></div><div><dt>Daily allowance remaining</dt><dd>{formatServiceMinutes(allowance.daily_remaining_minutes)}</dd></div></dl><p className="attendance-state">{result.student_status}</p>
      </>}</article>
    </div>
    <article className="qr-stage-card record-stage"><h3><b>3</b> {session?'Active Service Session':'Record Attendance'}</h3>
      {error&&<p className="error-message" role="alert">{error}</p>}
      {!verified?<p className="qr-recent-empty">Verify a student to select service time.</p>:result.active_session_elsewhere?<p className="error-message" role="alert">Active Service Session Found. This student is timed in with another department. Contact the supervising staff to record Time Out.</p>:session?<div className="service-active-panel">
        <div className="service-active-heading"><span className="scanner-state active"><i/>Community service in progress</span><strong>{session.session_type==='FIXED'?formatServiceMinutes(session.selected_duration_minutes)+' target':'Open Time Session'}</strong></div>
        <div className="service-active-clock"><span>{session.session_type==='FIXED'?'Time remaining':'Time elapsed'}</span><ServiceCountdown session={session} now={now} className="service-large-clock"/></div>
        <dl className="service-confirm-details"><div><dt>Time In</dt><dd>{formatManilaTime(session.time_in)}</dd></div><div><dt>{session.session_type==='FIXED'?'Expected completion':'Credit stops at'}</dt><dd>{formatManilaTime(session.session_type==='FIXED'?session.expected_completion_at:session.credit_cutoff_at)}</dd></div><div><dt>Available service time</dt><dd>{formatLiveServiceTime(timing.creditRemainingSeconds)}</dd></div><div><dt>Projected total / remaining</dt><dd>{formatServiceMinutes(progress.completed*60+projectedMinutes)} / {formatServiceMinutes(Math.max(0,progress.remaining*60-projectedMinutes))}</dd></div></dl>
        <p className="field-help">Current session time is credited only after Time Out is saved.</p><div className="service-confirm-actions"><button type="button" className="secondary-button" onClick={()=>setStudentOpen(true)}>View Student</button><button type="button" className={'time-out-button'+(timing.targetCompleted||timing.limitReached?' service-target-ready':'')} onClick={()=>setTimeOutOpen(true)} disabled={isSubmitting}>Time Out</button></div>
      </div>:<>
        {available>0&&result.assignment?<><div className="service-duration-heading"><h4>How long will the student serve today?</h4><p>Minimum 2 hours · Maximum 8 credited hours per Manila calendar day</p></div>
          {available<120&&<p className="service-timer-warning">Only {formatServiceMinutes(available)} is available before the requirement, daily allowance, or midnight cutoff. A final-remainder session is allowed.</p>}
          <div className="service-duration-grid">{[120,180,240,300,360,420,480].map(minutes=>preset(minutes,minutes/60+' Hours',minutes===120?'Minimum':minutes===480?'Maximum':null))}
            <div><button type="button" className={'service-duration-tile'+(form.session_type==='OPEN_TIME'?' selected':'')} aria-pressed={form.session_type==='OPEN_TIME'} onClick={()=>choose('OPEN_TIME',null)} disabled={isSubmitting}><strong>Open Time</strong><small>Up to {formatServiceMinutes(available)}</small></button></div>
            {available<120&&preset(available,'Final remainder',formatServiceMinutes(available))}
          </div>
          <div className="service-confirm-panel"><div className="record-fields"><label>Department<input readOnly value={result.assignment.department_name||''}/></label><label>Supervising officer<select name="supervising_officer_id" value={form.supervising_officer_id||''} onChange={onFieldChange} disabled={isSubmitting||officers.length<=1}><option value="">{noOfficer?'No authorized officer available':'Select supervising officer'}</option>{officers.map(officer=><option key={officer.officer_user_id} value={officer.officer_user_id}>{officer.first_name} {officer.last_name} · {formatDisplayLabel(officer.role)}</option>)}</select></label><label><span className="record-field-label">Attendance note <small>Optional</small></span><input name="notes" maxLength="500" value={form.notes} onChange={onFieldChange} disabled={isSubmitting}/></label></div>
            {noOfficer&&<p className="error-message">Contact the Discipline Office: no authorized officer is currently available.</p>}
            {selectedValid&&<dl className="service-confirm-details"><div><dt>Selected service</dt><dd>{form.session_type==='OPEN_TIME'?'Open Time':formatServiceMinutes(selected)}</dd></div><div><dt>Time In estimate</dt><dd>{formatManilaTime(now)}</dd></div><div><dt>{selected===null?'Maximum today':'Expected completion'}</dt><dd>{selected===null?formatServiceMinutes(available):formatManilaTime(now+selected*60000)}</dd></div><div><dt>Credit stops at midnight</dt><dd>{formatManilaTime(allowance.day_ends_at)}</dd></div></dl>}
            <div className="service-confirm-actions"><p className="field-help">Recorded by {recorder?.username||'authenticated staff'} · {formatDisplayLabel(recorder?.role)}</p><button type="button" onClick={()=>onAction('time-in')} disabled={!selectedValid||!form.supervising_officer_id||noOfficer||isSubmitting}>{isSubmitting?'Recording…':'Confirm Time In'}</button></div>
          </div></>:<p className="service-timer-warning">{Number(allowance.daily_remaining_minutes)===0?'Daily Community Service Limit Reached. New service can begin tomorrow.':result.assignment?'No creditable service time remains.':'Select an eligible assignment to continue.'}</p>}
      </>}
      {result?.action==='time-out'&&<p className="success-message" role="status">Time Out saved. {formatServiceMinutes(result.session?.credited_minutes)} credited.</p>}
    </article>
    {history.length>0&&<article className="qr-stage-card recent-stage"><h3>Community Service History</h3><div className="responsive-table"><table className="responsive-record-table"><thead><tr><th>Date / Department</th><th>Time In / Out</th><th>Mode / Target</th><th>Actual / Credited</th><th>Status</th><th>Authorized by / Notes</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td data-label="Date / Department">{formatManilaDateTime(item.time_in)}<small>{item.department_name}</small></td><td data-label="Time In / Out">{formatManilaTime(item.time_in)} / {formatManilaTime(item.time_out)||'Active'}</td><td data-label="Mode / Target">{item.session_type==='FIXED'?formatServiceMinutes(item.selected_duration_minutes):item.session_type==='OPEN_TIME'?'Open Time':'Legacy session'}</td><td data-label="Actual / Credited">{item.worked_minutes==null?'—':formatServiceMinutes(item.worked_minutes)} / {item.credited_minutes==null?'—':formatServiceMinutes(item.credited_minutes)}</td><td data-label="Status">{formatDisplayLabel(item.completion_reason||item.status)}</td><td data-label="Authorized by / Notes">{item.time_out_recorder_name||item.time_in_recorder_name||'Staff #'+(item.time_out_by_user_id||item.time_in_by_user_id)} · {formatDisplayLabel(item.time_out_role||item.time_in_role)}<small>{item.result_notes||item.notes||'—'}</small></td></tr>)}</tbody></table></div></article>}
{studentOpen&&verified&&<Modal title="Student information" onClose={()=>setStudentOpen(false)}><div className="verified-student"><Avatar identity={result.student}/><div><h3>{result.student.first_name} {result.student.last_name}</h3><p>{result.student.student_number}</p><p>{academicSummary(result.student)}</p><p>{result.student.section}</p><p>{result.assignment?.department_name}</p><p>{result.student_status}</p></div></div></Modal>}
    {timeOutOpen&&session&&<ServiceTimeOutDialog session={session} token={token} supervisingOfficerId={form.supervising_officer_id} initialNotes={form.notes} onClose={()=>setTimeOutOpen(false)} onSaved={onAttendanceSaved}/>}
  </section>
}
