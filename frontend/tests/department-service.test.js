import test from 'node:test'
import assert from 'node:assert/strict'
import { filterDepartmentService, formatLiveServiceTime, isActiveServiceSession, liveServiceSeconds, serviceProgress, serviceSessionTiming, summarizeDepartmentService } from '../src/lib/departmentService.js'

const assignments = [{ id: 1, first_name: 'Ana', last_name: 'Reyes', student_number: '02000111111', required_hours: '4', completed_hours: '1.5', remaining_hours: '2.5', status: 'IN_PROGRESS' }, { id: 2, first_name: 'Ben', last_name: 'Cruz', student_number: '02000222222', required_hours: 2, completed_hours: 2, remaining_hours: 0, status: 'COMPLETED' }]

test('department service summarizes authoritative assignment progress', () => {
  assert.deepEqual(summarizeDepartmentService(assignments), { total: 2, active: 1, completed: 1, remainingHours: 2.5 })
  assert.equal(serviceProgress(assignments[0]), 38)
})

test('department service filters by student and canonical status', () => {
  assert.deepEqual(filterDepartmentService(assignments, '22222', 'ALL').map(({ id }) => id), [2])
  assert.deepEqual(filterDepartmentService(assignments, '', 'ACTIVE').map(({ id }) => id), [1])
})

test('live service timer uses the recorded server time-in safely', () => {
  assert.equal(liveServiceSeconds('2026-08-31T08:00:00.000Z', Date.parse('2026-08-31T09:02:03.000Z')), 3723)
  assert.equal(formatLiveServiceTime(3723), '01:02:03')
  assert.equal(liveServiceSeconds('invalid', Date.now()), 0)
  assert.equal(liveServiceSeconds('2026-08-31T08:00:00.000Z', Date.parse('2026-08-31T09:02:03.000Z'), 1800), 1800)
  assert.deepEqual(serviceSessionTiming({ time_in: '2026-08-31T08:00:00.000Z', timer_limit_seconds: 1800 }, Date.parse('2026-08-31T09:02:03.000Z')), { elapsedSeconds: 1800, timerLimitSeconds: 1800, remainingSeconds: 0, limitReached: true })
})

test('remaining time counts down to zero without changing attendance', () => {
  const start = Date.parse('2026-08-31T08:00:00.000Z')
  const session = { time_in: new Date(start).toISOString(), timer_limit_seconds: 3600, status: 'ACTIVE', time_out: null }
  for (const [elapsed, remaining] of [[0, 3600], [1800, 1800], [3599, 1], [3600, 0], [7200, 0]]) {
    const timing = serviceSessionTiming(session, start + elapsed * 1000)
    assert.equal(timing.remainingSeconds, remaining)
    assert.equal(timing.limitReached, elapsed >= 3600)
    assert.equal(isActiveServiceSession(session), true)
  }
  assert.equal(serviceSessionTiming({ ...session, timer_limit_seconds: 0 }, start).remainingSeconds, 0)
  assert.equal(serviceSessionTiming({ ...session, timer_limit_seconds: undefined, remaining_hours: 1.5 }, start).remainingSeconds, 5400)
  assert.equal(serviceSessionTiming(session, start - 1000).remainingSeconds, 3600)
})

test('missing or malformed countdown data is unavailable, not zero', () => {
  const now = Date.now()
  for (const session of [null, {}, { timer_limit_seconds: 3600 },
    { time_in: 'invalid', timer_limit_seconds: 3600 },
    { time_in: new Date(now).toISOString() },
    { time_in: new Date(now).toISOString(), timer_limit_seconds: 'bad' }]) {
    assert.equal(serviceSessionTiming(session, now).remainingSeconds, null)
  }
})

test('live timer requires authoritative active status without a time-out', () => {
  assert.equal(isActiveServiceSession({ status: 'ACTIVE', time_out: null }), true)
  assert.equal(isActiveServiceSession({ status: 'COMPLETED', time_out: null }), false)
  assert.equal(isActiveServiceSession({ status: 'ACTIVE', time_out: '2026-09-22T05:00:00Z' }), false)
  assert.equal(isActiveServiceSession(null), false)
})
