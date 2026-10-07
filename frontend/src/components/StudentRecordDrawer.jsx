import { useId, useRef, useState } from 'react'
import { academicProgram, academicYear, academicLevelLabel, isSeniorHigh } from '../lib/studentAcademic.js'
import { handbookSanctionGuidance, summarizeStudentCondition } from '../lib/adminStudentReview.js'
import { formatDisplayLabel, formatDuration, formatIncidentDateTime } from '../lib/displayFormat.js'
import { displayPhilippinePhone } from '../lib/phone.js'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import OffenseIndicator from './OffenseIndicator.jsx'
import StudentAvatarUpload from './StudentAvatarUpload.jsx'
import GuardianContactPanel from './GuardianContactPanel.jsx'
import { StudentServiceTimeContent } from './StudentServiceTimeDrawer.jsx'
import '../styles/student-record.css'

const handbookNote = 'Use the documented category, repeat-offense history, case facts, and handbook procedure when deciding sanctions. The portal does not assign punishment automatically.'
const levelLabels = { NEUTRAL: 'Good Standing', MINOR_1: '1 Minor', MINOR_2: '2 Minors', MAJOR_LEVEL: 'Major Level', GRAVE: 'Grave' }

function ViolationCaseCard({ violation, onView, preview = false }) {
  const resolved = ['COMPLETE', 'CLEAR'].includes(violation.status)
  return <article className={`record-case-card${preview ? ' record-case-preview' : ''}`}>
    <header><h4>{violation.violation_name || `Violation #${violation.id}`}</h4><span className={`record-case-status${resolved ? ' record-case-resolved' : ''}`}>{formatDisplayLabel(violation.status)}</span></header>
    <p className="record-case-date"><PortalIcon name="calendar"/>{formatIncidentDateTime(violation.incident_date, violation.incident_time)} · {formatDisplayLabel(violation.severity, 'Severity unavailable')}</p>
    {violation.exact_offense && <p className="record-case-offense">{violation.exact_offense}</p>}
    <p className="record-case-description">{violation.description || violation.incident_details || 'No incident details recorded.'}</p>
    <button type="button" className="record-view-case" onClick={() => onView(violation)}><PortalIcon name="eye"/>View case</button>
    <dl className="record-case-service"><div><dt>Required Service</dt><dd>{formatDuration(violation.required_service_hours)}</dd></div><div><dt>Completed Service</dt><dd>{formatDuration(violation.completed_service_hours)}</dd></div></dl>
  </article>
}

export function StudentRecordContent({ student, violations = [], summary, loading = false, error, hasMore = false, onLoadMore, assignments = [], activeSessions = [], attendanceReady = true, attendanceError, token, onViewCase, onAddViolation, onPhotoUpdated }) {
  const id = useId()
  const tabsRef = useRef(null)
  const [tab, setTab] = useState('overview')
  const [visited, setVisited] = useState(['overview'])
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoDirty, setPhotoDirty] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const condition = summarizeStudentCondition(student.id, violations)
  const records = condition.records
  const total = summary?.total ?? condition.total
  const open = summary?.open ?? condition.open
  const resolved = summary?.resolved ?? condition.resolved
  const remaining = summary?.remainingHours ?? condition.remainingHours
  const level = summary?.offenseStatus?.indicator_level || student.offense_indicator_level || 'NEUTRAL'
  const standing = summary?.condition || (loading ? 'Loading status…' : condition.condition)
  const guidance = handbookSanctionGuidance(summary?.categoryCounts || [])
  const phone = displayPhilippinePhone(student.phone_number)
  const fullName = [student.first_name, student.middle_name, student.last_name, student.suffix].filter(Boolean).join(' ')
  const tabs = [['overview', 'Overview'], ['violations', `Violations (${total})`], ['service', 'Community Service'], ['contact', 'Contact & Guardian']]
  const selectTab = (next, focus = false) => { setTab(next); setVisited((current) => current.includes(next) ? current : [...current, next]); if (focus) tabsRef.current?.querySelectorAll('[role="tab"]')[tabs.findIndex(([key]) => key === next)]?.focus() }
  const tabKey = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    selectTab(tabs[next][0]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
  }
  const overviewFields = [['Student number', student.student_number], ['Academic level', academicLevelLabel(student)], [isSeniorHigh(student) ? 'Strand' : 'Program', academicProgram(student)], ['Section', student.section], [isSeniorHigh(student) ? 'Grade level' : 'Year level', academicYear(student)], ['Email', student.email], ['Phone', phone]]
  const recent = records.slice(0, 2)

  return <div className="student-record-content">
    <section className="record-profile" aria-label="Student identity">
      <div className="record-photo"><Avatar identity={student} className="record-avatar"/><button type="button" aria-label={`Edit photo for ${fullName}`} onClick={() => setPhotoOpen(true)}><PortalIcon name="camera" size={20}/></button></div>
      <div className="record-identity"><h3>{fullName}</h3><p>{student.student_number}</p><p>{[academicProgram(student), student.section, academicYear(student)].filter(Boolean).join(' • ')}</p><div className="record-contact"><span><PortalIcon name="mail"/>{student.email || 'Email not recorded'}</span><span><PortalIcon name="phone"/>{phone || 'Phone not recorded'}</span></div></div>
      <div className="record-profile-status"><span className={`record-standing${open ? ' record-requires-action' : ''}`}><PortalIcon name={open ? 'violations' : 'check'}/>{formatDisplayLabel(standing)}</span><span className="record-level"><PortalIcon name="book"/>{levelLabels[level] || 'Status unavailable'}</span></div>
    </section>
    <div ref={tabsRef} className="record-tabs" role="tablist" aria-label="Student record sections">{tabs.map(([key, label], index) => <button type="button" key={key} role="tab" id={`${id}-${key}-tab`} aria-controls={`${id}-${key}-panel`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)} onKeyDown={(event) => tabKey(event, index)}>{label}</button>)}</div>
    {error && <p className="error-message record-history-error" role="alert">{error}</p>}
    <section className="record-tab-panel record-overview-panel" role="tabpanel" id={`${id}-overview-panel`} aria-labelledby={`${id}-overview-tab`} hidden={tab !== 'overview'} tabIndex={0}>
      <section className="record-violation-summary" aria-labelledby={`${id}-summary-title`}><h4 id={`${id}-summary-title`}>Violation Summary</h4><div className="record-metrics">
        {[['Total Violations', total, 'info', 'red'], ['Open Violations', open, 'clock', 'orange'], ['Resolved Violations', resolved, 'check', 'green'], ['Remaining Service', formatDuration(remaining), 'clock', 'blue']].map(([label, value, icon, tone]) => <article key={label} className={`record-metric record-metric-${tone}`}><i><PortalIcon name={icon} size={26}/></i><div><span>{label}</span><strong>{loading && !summary ? '—' : value}</strong></div></article>)}
      </div></section>
      <section className="record-overview-card" aria-label="Student overview"><h4>Student Overview</h4><div className="record-overview-grid"><dl>{overviewFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl><aside className={`record-discipline-status record-discipline-${level.toLowerCase()}`}><OffenseIndicator level={level}/>{summary?.offenseStatus?.major_level_review_required ? <p>Review required for repeated minor offenses</p> : guidance.length > 0 && <p>{guidance[0].name}</p>}</aside></div></section>
      <section className="record-recent-cases" aria-label="Recent violations"><header className="record-section-heading"><h4>Recent Violations</h4><button type="button" onClick={() => selectTab('violations', true)}>View all ({total})</button></header>
        {loading && !recent.length ? <p className="record-empty" role="status">Loading violation history…</p> : !recent.length ? <p className="record-empty">No violation history for this student.</p> : <div className="record-case-grid">{recent.map((violation) => <ViolationCaseCard key={violation.id} violation={violation} onView={onViewCase} preview/>)}</div>}
      </section>
      <aside className="record-handbook-note"><i><PortalIcon name="info" size={22}/></i><div><strong>Handbook sanction reference</strong><p>{handbookNote}</p></div></aside>
    </section>
    <section className="record-tab-panel" role="tabpanel" id={`${id}-violations-panel`} aria-labelledby={`${id}-violations-tab`} hidden={tab !== 'violations'} tabIndex={0}>{visited.includes('violations') && <>
      <header className="record-section-heading"><div><h4>Disciplinary History</h4><p>{total} total · {open} open · {resolved} resolved</p></div><button type="button" className="record-primary-button" onClick={() => onAddViolation(student)}>＋ Add Violation</button></header>
      <section className="record-history-standing"><OffenseIndicator level={level}/><p>{summary?.offenseStatus?.major_level_review_required ? 'Major-level review required from repeated minor offenses.' : formatDisplayLabel(standing)}</p></section>
      {guidance.length > 0 && <section className="record-sanction-guidance" aria-label="Handbook sanction guidance"><h4>Handbook Sanction Reference</h4>{guidance.map((item) => <article key={item.code}><strong>{item.name}</strong><span>{item.count} recorded offense{Number(item.count) === 1 ? '' : 's'}</span><p>{item.guidance}</p></article>)}</section>}
      {loading && !records.length ? <p className="record-empty" role="status">Loading violation history…</p> : !records.length ? <p className="record-empty">No violation history for this student.</p> : <div className="record-history-list">{records.map((violation) => <ViolationCaseCard key={violation.id} violation={violation} onView={onViewCase}/>)}</div>}
      {hasMore && <button type="button" className="record-load-more" disabled={loading} onClick={onLoadMore}>{loading ? 'Loading…' : 'Load older violations'}</button>}
      <aside className="record-handbook-note"><i><PortalIcon name="info"/></i><div><strong>Handbook sanction reference</strong><p>{handbookNote}</p></div></aside>
    </>}</section>
    <section className="record-tab-panel record-service-panel" role="tabpanel" id={`${id}-service-panel`} aria-labelledby={`${id}-service-tab`} hidden={tab !== 'service'} tabIndex={0}>{visited.includes('service') && <StudentServiceTimeContent student={student} assignments={assignments} activeSessions={activeSessions} attendanceReady={attendanceReady} attendanceError={attendanceError}/>}</section>
    <section className="record-tab-panel record-guardian-panel" role="tabpanel" id={`${id}-contact-panel`} aria-labelledby={`${id}-contact-tab`} hidden={tab !== 'contact'} tabIndex={0}>{visited.includes('contact') && <GuardianContactPanel token={token} student={student} showClose={false}/>}</section>
    {photoOpen && <Modal title="Edit Student Photo" className="student-photo-modal" dirty={photoDirty && !photoBusy} onClose={() => { if (!photoBusy) setPhotoOpen(false) }}><StudentAvatarUpload student={student} onUpdated={onPhotoUpdated} onDirtyChange={setPhotoDirty} onBusyChange={setPhotoBusy}/></Modal>}
  </div>
}

export default function StudentRecordDrawer({ onClose, ...props }) {
  return <Modal title={`Student record — ${props.student.student_number}`} className="student-record-modal" drawer onClose={onClose}><StudentRecordContent {...props}/></Modal>
}
