import { useMemo, useState } from 'react'
import { filterDepartmentService, serviceProgress, summarizeDepartmentService } from '../lib/departmentService.js'

function DepartmentCommunityService({ assignments, loading, error, onOpenScanner }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const summary = summarizeDepartmentService(assignments)
  const visible = useMemo(() => filterDepartmentService(assignments, query, status), [assignments, query, status])

  return <div className="department-service-page">
    <section className="department-welcome"><div><p className="eyebrow">Service oversight</p><h2>Community service</h2><p>Monitor assignments served through your authenticated department.</p></div><button type="button" onClick={onOpenScanner}>Record attendance</button></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="stats-grid department-stats" aria-label="Community service summary"><article className="stat-card"><span>Assignments</span><strong>{summary.total}</strong></article><article className="stat-card"><span>Active</span><strong>{summary.active}</strong></article><article className="stat-card"><span>Completed</span><strong>{summary.completed}</strong></article><article className="stat-card"><span>Hours remaining</span><strong>{summary.remainingHours.toFixed(2)}</strong></article></section>
    <section className="student-roster-tools" aria-label="Filter service assignments"><label><span>Search students</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or student number" /></label><label><span>Assignment status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All assignments</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ADMIN_CLOSED">Administratively closed</option><option value="INVALID_CANCELLED">Invalid / cancelled</option></select></label></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">Scoped assignments</p><h3>Service progress</h3></div><span>{visible.length} records</span></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Loading service assignments…</p></div> : visible.length === 0 ? <div className="department-empty"><h4>No matching assignments</h4><p>Assignments appear after service attendance is recorded in your department.</p></div> : <div className="service-assignment-list">{visible.map((item) => { const progress = serviceProgress(item); return <article key={item.id}><div className="service-assignment-heading"><div><h4>{item.first_name} {item.last_name}</h4><span>{item.student_number} · Assignment #{item.id}</span></div><span className="status-badge">{String(item.status).replaceAll('_', ' ')}</span></div><div className="service-progress-meta"><span>{Number(item.completed_hours || 0).toFixed(2)} of {Number(item.required_hours || 0).toFixed(2)} hours</span><strong>{progress}%</strong></div><div className="progress-track" role="progressbar" aria-label={`${item.first_name} ${item.last_name} service progress`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div><p>{Number(item.remaining_hours || 0).toFixed(2)} hours remaining</p></article> })}</div>}
    </section><p className="scope-note">Only assignments with attendance in your department are visible. Management remains with the Discipline Office.</p>
  </div>
}
export default DepartmentCommunityService
