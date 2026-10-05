import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceRoster, attendanceTransitions } from '../src/lib/attendanceStatus.js'

const active = { id: 11, assignment_id: 21, student_id: 1, status: 'ACTIVE', time_out: null }
const completed = { ...active, status: 'COMPLETED', time_out: '2026-10-05T02:30:00Z' }

test('attendance alerts suppress initial loads and duplicate refreshes', () => {
  assert.deepEqual(attendanceTransitions(null, [active]), [])
  assert.deepEqual(attendanceTransitions(null, [completed]), [])
  assert.deepEqual(attendanceTransitions([], [active]), [{ action: 'TIME IN', assignmentId: 21, sessionId: '11' }])
  assert.deepEqual(attendanceTransitions([active], [{ ...active }]), [])
  assert.deepEqual(attendanceTransitions([active], [completed]), [{ action: 'TIME OUT', assignmentId: 21, sessionId: '11' }])
  assert.deepEqual(attendanceTransitions([completed], [{ ...completed }]), [])
  assert.deepEqual(attendanceTransitions([], [completed]), [{ action: 'TIME OUT', assignmentId: 21, sessionId: '11' }])
})

test('attendance changes remain per session when one student has multiple assignments', () => {
  const second = { ...active, id: 12, assignment_id: 22 }
  assert.deepEqual(attendanceTransitions([active, second], [completed, second]), [
    { action: 'TIME OUT', assignmentId: 21, sessionId: '11' }
  ])
  assert.deepEqual(attendanceTransitions([active], []), [{ action: 'TIME OUT', assignmentId: 21, sessionId: '11' }])
})

test('attendance roster includes TIME OUT students and groups all active sessions once per student', () => {
  const students = [{ id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '001' },
    { id: 2, first_name: 'Ben', last_name: 'Cruz', student_number: '002' },
    { id: 3, first_name: 'No', last_name: 'Assignment' }]
  const assignments = [{ id: 21, student_id: 1 }, { id: 22, student_id: 1 }, { id: 23, student_id: 2 }]
  const sessions = [{ ...active, department_name: 'Library' }, { ...active, id: 12, assignment_id: 22, department_name: 'Clinic' }]
  const roster = attendanceRoster(students, assignments, sessions)
  assert.equal(roster.length, 2)
  assert.equal(roster[0].student_id, 1)
  assert.equal(roster[0].sessions.length, 2)
  assert.equal(roster[1].sessions.length, 0)
  assert.deepEqual(attendanceRoster(students, assignments, sessions, '002').map((row) => row.student_id), [2])
  assert.deepEqual(attendanceRoster(students, assignments, sessions, 'clinic').map((row) => row.student_id), [1])
  const afterTimeOut = attendanceRoster(students, assignments, [completed])
  assert.equal(afterTimeOut.length, 2)
  assert.ok(afterTimeOut.every((row) => row.sessions.length === 0))
})
