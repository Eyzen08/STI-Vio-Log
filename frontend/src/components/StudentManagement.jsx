import { useMemo, useState } from 'react'
import { buildStudentDirectory, filterStudentDirectory } from '../lib/adminStudentReview.js'
import { STRANDS, yearOptions } from '../lib/studentAcademic.js'
import { formatDuration } from '../lib/displayFormat.js'
import { isActiveServiceSession } from '../lib/departmentService.js'
import Avatar from './Avatar.jsx'
import PortalIcon from './PortalIcon.jsx'
import StudentAccountActions from './StudentAccountActions.jsx'
import StudentDirectorySelect from './StudentDirectorySelect.jsx'
import '../styles/admin-students.css'

const clearanceLabels = { NOT_CLEARED: 'Not Cleared', ELIGIBLE: 'Eligible', CLEARED: 'Cleared' }
const tabs = [['all', 'All Students'], ['violations', 'With Violations'], ['service', 'Community Service'], ['cleared', 'Cleared']]
const pageSize = 5
const yearFilters = [{value:'',label:'All Years'}, ...yearOptions('COLLEGE').map(([,label])=>({value:label,label})), {value:'SENIOR_HIGH_SCHOOL',label:'Senior High School'}, ...yearOptions('SENIOR_HIGH_SCHOOL').map(([,label])=>({value:label,label}))]

export default function StudentManagement({ students = [], violations = [], assignments = [], clearances = [], activeSessions = [], attendanceReady = true, loading = false, query = '', onQueryChange, token, onAdd, onView, onServiceTime, onGuardianContact, onUpdated }) {
  const [filters, setFilters] = useState({ program: '', year: '', status: '', tab: 'all', severity: '', attendance: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pagination, setPagination] = useState({ key: '', page: 1 })
  const rows = useMemo(() => {
    const timedIn = new Set(attendanceReady ? activeSessions.filter(isActiveServiceSession).map((item) => Number(item.student_id)) : [])
    return buildStudentDirectory(students, violations, assignments, clearances).map((row) => ({ ...row, timedIn: timedIn.has(Number(row.id)) }))
  }, [students, violations, assignments, clearances, activeSessions, attendanceReady])
  const counts = { all: rows.length, violations: rows.filter((row) => row.condition.total).length, service: rows.filter((row) => row.inService).length, cleared: rows.filter((row) => row.clearance === 'CLEARED').length }
  const visible = filterStudentDirectory(rows, { query, ...filters })
  const filterKey = JSON.stringify([query, filters])
  if (pagination.key !== filterKey) setPagination({ key: filterKey, page: 1 })
  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const page = pagination.key === filterKey ? Math.min(pagination.page, pages) : 1
  const first = (page - 1) * pageSize
  const currentRows = visible.slice(first, first + pageSize)
  const options = (field) => [...new Set(rows.map((row) => row[field]))].filter((value) => value !== 'Not recorded').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }))
  const setPage = (next) => setPagination({ key: filterKey, page: next })
  const filtered = query.trim() || Object.entries(filters).some(([key, value]) => value && !(key === 'tab' && value === 'all'))
  const pageStart = Math.max(1, Math.min(page - 2, pages - 4))

  return <section className="student-management-page" aria-labelledby="student-management-title">
    <header className="student-management-header portal-page-header">
      <div><nav className="student-breadcrumb" aria-label="Breadcrumb"><a href="/admin/dashboard">Home</a><span aria-hidden="true">/</span><span>Students</span></nav><h2 id="student-management-title">Student Management</h2><p>View and manage student records, violations, community service, and clearance status.</p></div>
      <button type="button" className="student-add-button" onClick={onAdd}><span aria-hidden="true">＋</span> Add Student</button>
    </header>
    <section className="student-summary-grid" aria-label="Student summary">
      {[['all', 'students', 'Total Students', 'blue'], ['violations', 'violations', 'With Violations', 'red'], ['service', 'service', 'Ongoing Community Service', 'orange'], ['cleared', 'clearance', 'Cleared Students', 'green']].map(([tab, icon, label, tone]) => <button type="button" className={`student-summary-card student-metric-${tone}`} key={tab} onClick={() => setFilters({ program: '', year: '', status: '', tab, severity: '', attendance: '' })}>
        <i><PortalIcon name={icon} size={32}/></i><span><strong>{loading ? '—' : counts[tab]}</strong><small>{label}</small></span><PortalIcon name="chevron-right" className="student-metric-chevron"/>
      </button>)}
    </section>
    <section className="student-directory-card" aria-labelledby="student-directory-title" aria-busy={loading}>
      <header className="student-directory-heading"><div><h3 id="student-directory-title">Student Directory</h3><p>Search and manage student records.</p></div><span>{loading ? 'Loading…' : `${visible.length} student${visible.length === 1 ? '' : 's'}`}</span></header>
      <div className="student-directory-toolbar">
        <label className="student-directory-search"><span className="sr-only">Search students</span><PortalIcon name="search" size={22}/><input type="search" name="student-directory-filter" autoComplete="off" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search student number, name, or program..."/></label>
        <StudentDirectorySelect label="Program" value={filters.program} onChange={(value) => setFilter('program', value)} options={[{ value: '', label: 'All Programs' }, ...options('programLabel').filter((value) => !STRANDS.some(([code]) => code === value)).map((value) => ({ value, label: value })), ...STRANDS.map(([code]) => ({ value: code, label: code, section: 'Senior High School' }))]}/>
        <StudentDirectorySelect label="Year Level" value={filters.year} onChange={(value) => setFilter('year', value)} options={[...yearFilters, ...options('yearLabel').filter((value) => !yearFilters.some((option) => option.label === value)).map((value) => ({ value, label: value }))]}/>
        <StudentDirectorySelect label="Status" value={filters.status} onChange={(value) => setFilter('status', value)} options={[{ value: '', label: 'All Statuses' }, ...Object.entries(clearanceLabels).map(([value, label]) => ({ value, label }))]}/>
        <button type="button" className="student-filter-toggle" aria-expanded={filtersOpen} aria-controls="student-extra-filters" onClick={() => setFiltersOpen(!filtersOpen)}><PortalIcon name="filter" size={22}/>Filters{(filters.severity || filters.attendance) && <span className="student-filter-count">{Number(Boolean(filters.severity)) + Number(Boolean(filters.attendance))}</span>}</button>
      </div>
      {filtersOpen && <div id="student-extra-filters" className="student-extra-filters">
        <StudentDirectorySelect label="Offense severity" value={filters.severity} onChange={(value) => setFilter('severity', value)} options={[{ value: '', label: 'All Severities' }, { value: 'minor', label: 'Minor' }, { value: 'major', label: 'Major / Repeat Minor' }, { value: 'grave', label: 'Grave' }, { value: 'neutral', label: 'No Violations' }]}/>
        <StudentDirectorySelect label="Attendance" value={filters.attendance} onChange={(value) => setFilter('attendance', value)} disabled={!attendanceReady} options={[{ value: '', label: 'All Attendance' }, { value: 'timed-in', label: 'Currently Timed In' }]}/>
        <button type="button" onClick={() => { setFilters({ program: '', year: '', status: '', tab: 'all', severity: '', attendance: '' }); onQueryChange('') }}>Clear Filters</button>
      </div>}
      <div className="student-directory-tabs" role="group" aria-label="Student quick filters">{tabs.map(([key, label]) => <button type="button" key={key} aria-pressed={filters.tab === key} onClick={() => setFilter('tab', key)}>{label} ({counts[key]})</button>)}</div>
      <div className="student-directory-table-wrap" role="region" aria-label="Student directory records" tabIndex={0}>
        <table className="student-directory-table">
          <colgroup>{[20, 16, 15, 16, 16, 17].map((width, index) => <col key={index} style={{ width: `${width}%` }}/>)}</colgroup>
          <thead><tr>{['Student', 'Academic Info', 'Violations', 'Community Service', 'Clearance', 'Action'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={6} className="student-directory-empty" role="status">Loading student records…</td></tr> : currentRows.length === 0 ? <tr><td colSpan={6} className="student-directory-empty"><strong>{filtered ? 'No students match these filters.' : 'No student records yet.'}</strong>{filtered && <button type="button" onClick={() => { setFilters({ program: '', year: '', status: '', tab: 'all', severity: '', attendance: '' }); onQueryChange('') }}>Clear Filters</button>}</td></tr> : currentRows.map((student) => <tr key={student.id}>
            <td><div className="directory-student"><Avatar identity={student} className={`directory-avatar avatar-tone-${Number(student.id) % 5}`}/><div><strong>{student.first_name} {student.last_name}</strong><small>{student.student_number}</small>{student.timedIn && <span className="directory-timed-in">● Timed In</span>}</div></div></td>
            <td><div className="directory-academic"><span>{student.programLabel}{student.section && <> <b aria-hidden="true">•</b> {student.section}</>}</span><small>{student.yearLabel === 'Not recorded' ? '—' : student.yearLabel}</small></div></td>
            <td><div className={`directory-violation directory-severity-${student.tone}`}><i aria-hidden="true"/><div>{student.condition.total ? <><span>{student.condition.total} total / {student.condition.open} open</span><small>{student.severity}</small></> : <span>No violations</span>}</div></div></td>
            <td>{student.service.required > 0 ? <div className="directory-service"><progress max="100" value={student.service.percent} aria-label={`Community service for ${student.first_name} ${student.last_name}`}/><small>{formatDuration(student.service.completed)} / {formatDuration(student.service.required)}</small></div> : <span className="directory-muted">—</span>}</td>
            <td><span className={`directory-clearance clearance-${student.clearance.toLowerCase()}`}>{clearanceLabels[student.clearance]}</span></td>
            <td><div className="directory-actions"><button type="button" className="directory-view-button" aria-label={`View Student ${student.first_name} ${student.last_name}`} onClick={() => onView(student)}>View Student</button><StudentAccountActions token={token} student={student} onUpdated={onUpdated} onServiceTime={() => onServiceTime(student)} onGuardianContact={() => onGuardianContact(student)}/></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="student-directory-footer"><span aria-live="polite">{loading ? 'Loading student records…' : `Showing ${visible.length ? first + 1 : 0}–${Math.min(first + pageSize, visible.length)} of ${visible.length} students`}</span><nav aria-label="Student directory pagination">
        <button type="button" aria-label="Previous page" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}><PortalIcon name="chevron-right" className="previous-page"/></button>
        {Array.from({ length: Math.min(5, pages) }, (_, index) => pageStart + index).map((number) => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={page === number ? 'page' : undefined} disabled={loading} onClick={() => setPage(number)}>{number}</button>)}
        <button type="button" aria-label="Next page" disabled={page === pages || loading} onClick={() => setPage(page + 1)}><PortalIcon name="chevron-right"/></button>
      </nav></footer>
    </section>
  </section>
}
