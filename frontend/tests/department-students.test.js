import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDepartmentStudentRoster, filterDepartmentStudents } from '../src/lib/departmentStudents.js'

const report = { data: [
  { student_id: 8, first_name: 'Ana', last_name: 'Reyes', student_number: '02000111111', assignment_status: 'IN_PROGRESS', remaining_hours: '1.5', total_completed_sessions: 2, total_credited_minutes: 90, latest_attendance_at: '2026-08-20T09:00:00Z' },
  { student_id: 8, first_name: 'Ana', last_name: 'Reyes', student_number: '02000111111', assignment_status: 'COMPLETED', remaining_hours: 0, total_completed_sessions: 1, total_credited_minutes: 60, latest_attendance_at: '2026-08-22T09:00:00Z' },
  { student_id: 4, first_name: 'Ben', last_name: 'Cruz', student_number: '02000222222', assignment_status: 'COMPLETED', remaining_hours: 0, total_completed_sessions: 3, total_credited_minutes: 180, latest_attendance_at: '2026-08-21T09:00:00Z' }
] }

test('department student roster aggregates assignments without duplicating students', () => {
  const roster = buildDepartmentStudentRoster(report)
  assert.equal(roster.length, 2)
  assert.deepEqual(roster[0], { id: 8, studentNumber: '02000111111', name: 'Ana Reyes', assignments: 2, completedSessions: 3, creditedMinutes: 150, remainingHours: 1.5, hasActiveService: true, latestAttendanceAt: '2026-08-22T09:00:00Z' })
})

test('department student roster supports search and service-standing filters', () => {
  const roster = buildDepartmentStudentRoster(report)
  assert.deepEqual(filterDepartmentStudents(roster, '222222', 'ALL').map(({ name }) => name), ['Ben Cruz'])
  assert.deepEqual(filterDepartmentStudents(roster, '', 'ACTIVE').map(({ name }) => name), ['Ana Reyes'])
  assert.deepEqual(filterDepartmentStudents(roster, '', 'COMPLETE').map(({ name }) => name), ['Ben Cruz'])
})
