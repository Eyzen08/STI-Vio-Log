import { useMemo, useState } from 'react'
import { formatDuration } from '../lib/departmentDashboard.js'
import { displayDepartmentDtrDate } from '../lib/departmentDtr.js'
import { buildDepartmentStudentRoster, filterDepartmentStudents } from '../lib/departmentStudents.js'
import GuardianContactPanel from './GuardianContactPanel.jsx'

function DepartmentStudents({ report, loading, error, onOpenDtr, token }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [contactStudent, setContactStudent] = useState(null)
  const roster = useMemo(() => buildDepartmentStudentRoster(report), [report])
  const visibleStudents = useMemo(() => filterDepartmentStudents(roster, query, status), [roster, query, status])

  return (
    <div className="department-students-page">
      <section className="department-welcome">
        <div><p className="eyebrow">Department roster</p><h2>Students served</h2><p>Students with community-service attendance recorded by your department.</p></div>
        <button type="button" onClick={onOpenDtr}>View full DTR</button>
      </section>

      {error && <p className="error-message dashboard-error" role="alert">{error}</p>}

      <section className="student-roster-tools" aria-label="Filter department students">
        <label><span>Search roster</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or student number" /></label>
        <label><span>Service standing</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All students</option><option value="ACTIVE">Active service</option><option value="COMPLETE">No remaining service</option></select></label>
      </section>

      <section className="table-card" aria-busy={loading}>
        <div className="table-header"><div><p className="eyebrow">Scoped directory</p><h3>Community-service students</h3></div><span>{visibleStudents.length} of {roster.length}</span></div>
        {loading ? (
          <div className="department-empty" aria-live="polite"><p>Loading department students…</p></div>
        ) : visibleStudents.length === 0 ? (
          <div className="department-empty"><h4>{roster.length ? 'No students match these filters' : 'No students served yet'}</h4><p>{roster.length ? 'Try another name or service standing.' : 'Students appear after attendance is recorded in your department.'}</p></div>
        ) : (
          <div className="department-student-grid">
            {visibleStudents.map((student) => (
              <article key={student.id}>
                <div className="student-roster-heading"><div className="student-avatar" aria-hidden="true">{student.name.charAt(0)}</div><div><h4>{student.name}</h4><span>{student.studentNumber}</span></div><span className={`status-badge ${student.hasActiveService ? 'status-open' : 'status-complete'}`}>{student.hasActiveService ? 'Active service' : 'No remaining service'}</span></div>
                <dl><div><dt>Assignments</dt><dd>{student.assignments}</dd></div><div><dt>Sessions</dt><dd>{student.completedSessions}</dd></div><div><dt>Credited</dt><dd>{formatDuration(student.creditedMinutes)}</dd></div><div><dt>Remaining</dt><dd>{student.remainingHours.toFixed(2)} hrs</dd></div></dl>
                <p>Latest attendance: {displayDepartmentDtrDate(student.latestAttendanceAt)}</p>
                <button type="button" className="secondary-button" onClick={() => setContactStudent(student)}>Parent/Guardian contact</button>
              </article>
            ))}
          </div>
        )}
      </section>
      {contactStudent && <GuardianContactPanel token={token} student={contactStudent} onClose={() => setContactStudent(null)} />}
      <p className="scope-note">This roster includes only students with attendance in your authenticated department.</p>
    </div>
  )
}

export default DepartmentStudents
