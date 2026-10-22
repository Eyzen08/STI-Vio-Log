const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceAllowance, validateDuration, sessionTiming, calculateCredit } = require('../src/services/communityServiceTiming');

const now = '2026-10-07T01:00:00Z'; // 9 AM Manila
test('daily allowance covers all assignments and preserves final fractional balances', () => {
  assert.equal(serviceAllowance({ remaining_hours: 20 }, 180, now).available_minutes, 300);
  assert.equal(serviceAllowance({ remaining_hours: 0.01 }, 0, now).available_minutes, 0.6);
  assert.equal(serviceAllowance({ remaining_hours: 20 }, 480, now).available_minutes, 0);
  assert.equal(serviceAllowance({ remaining_hours: 20 }, 0, '2026-10-07T15:30:00Z').available_minutes, 30);
});
test('normal durations, Open Time and exact final remainder are validated', () => {
  for (let minutes = 120; minutes <= 480; minutes += 60) assert.equal(validateDuration('FIXED', minutes, 480).selected_duration_minutes, minutes);
  assert.equal(validateDuration('OPEN_TIME', null, 60).session_type, 'OPEN_TIME');
  assert.equal(validateDuration('FIXED', 0.6, 0.6).selected_duration_minutes, 0.6);
  for (const [type, minutes, cap] of [['FIXED', 60, 480], ['FIXED', 150, 480], ['FIXED', 180, 120], ['FIXED', 30, 60], ['BAD', 120, 480], ['OPEN_TIME', 120, 480], ['FIXED', NaN, 480]]) assert.throws(() => validateDuration(type, minutes, cap));
});
test('fixed sessions accept the exact assignment balance below eight hours', () => {
  for (const balance of [390, 90, 0.6, 330.00002]) {
    assert.equal(validateDuration('FIXED', balance, balance, balance).selected_duration_minutes, balance);
  }
  assert.equal(validateDuration('FIXED', 330.00001999999995, 330.00002, 330.00002).selected_duration_minutes, 330.00002);
  for (const [selected, available, remaining] of [[390, 300, 390], [390, 30, 390], [90, 60, 90], [150, 390, 390], [390, 480, 480], [479.5, 480, 480], [480.5, 500, 480.5]]) {
    assert.throws(() => validateDuration('FIXED', selected, available, remaining), { code: 'INVALID_SERVICE_DURATION' });
  }
  assert.equal(validateDuration('FIXED', 30, 30, 390).selected_duration_minutes, 30);
});
test('fixed target reaches zero while overtime and actual time keep increasing', () => {
  const session = { time_in: now, session_type: 'FIXED', selected_duration_minutes: 120, credit_cutoff_at: '2026-10-07T09:00:00Z', service_date: '2026-10-07' };
  const timing = sessionTiming(session, { remaining_hours: 20 }, 0, '2026-10-07T03:05:00Z');
  assert.equal(timing.remaining_seconds, 0);
  assert.equal(timing.additional_seconds, 300);
  assert.equal(timing.actual_elapsed_seconds, 7500);
  assert.equal(timing.target_completed, true);
  const credit = calculateCredit(session, { required_hours: 20, completed_hours: 0, remaining_hours: 20 }, 0, '2026-10-07T03:05:00Z');
  assert.equal(credit.creditedMinutes, 125);
  assert.equal(credit.completionReason, 'COMPLETED');
});
test('legacy fixed exits preserve early status while flexible sessions have no minimum', () => {
  const assignment = { required_hours: 20, completed_hours: 0, remaining_hours: 20 };
  const session = { time_in: now, session_type: 'FIXED', selected_duration_minutes: 120, credit_cutoff_at: '2026-10-07T09:00:00Z' };
  assert.equal(calculateCredit(session, assignment, 0, '2026-10-07T02:30:59Z').creditedMinutes, 90);
  assert.equal(calculateCredit(session, assignment, 0, '2026-10-07T02:30:59Z').completionReason, 'EARLY_TIME_OUT');
  const flexible = calculateCredit({ ...session, session_type: 'OPEN_TIME', selected_duration_minutes: null }, assignment, 0, '2026-10-07T02:00:00Z');
  assert.equal(flexible.completionReason, 'COMPLETED');
  assert.equal(flexible.attendanceOutcome, 'TODAYS_SERVICE_COMPLETED');
});

test('paused service freezes earned time and finished pauses extend the work allowance', () => {
  const assignment = { required_hours: 2, completed_hours: 0, remaining_hours: 2 };
  const session = { time_in: now, session_type: 'OPEN_TIME', credit_cutoff_at: '2026-10-07T03:00:00Z',
    pause_history: [{ started_at: '2026-10-07T01:30:00Z', ended_at: null }] };
  const paused = calculateCredit(session, assignment, 0, '2026-10-07T03:30:00Z');
  assert.equal(paused.creditedMinutes, 30);
  assert.equal(paused.workedMinutes, 30);
  assert.equal(paused.paused_at, '2026-10-07T01:30:00Z');
  assert.equal(paused.limit_reached, false);
  const resumed = { ...session, pause_history: [{ started_at: '2026-10-07T01:30:00Z', ended_at: '2026-10-07T03:30:00Z' }] };
  const running = calculateCredit(resumed, assignment, 0, '2026-10-07T04:00:00Z');
  assert.equal(running.creditedMinutes, 60);
  assert.equal(running.paused_seconds, 7200);
  assert.equal(running.credit_cutoff_at, '2026-10-07T05:00:00.000Z');
  const completed = calculateCredit(resumed, assignment, 0, '2026-10-07T05:00:00Z');
  assert.equal(completed.creditedMinutes, 120);
  assert.equal(completed.attendanceOutcome, 'SERVICE_COMPLETED');
});

test('pause intervals are subtracted before rounding and clipped correctly at midnight', () => {
  const assignment = { required_hours: 20, completed_hours: 0, remaining_hours: 20 };
  const short = { time_in: now, session_type: 'OPEN_TIME', credit_cutoff_at: '2026-10-07T09:00:00Z', pause_history: [
    { started_at: '2026-10-07T01:00:40Z', ended_at: '2026-10-07T01:00:50Z' },
    { started_at: '2026-10-07T01:01:20Z', ended_at: '2026-10-07T01:01:30Z' }
  ] };
  const result = calculateCredit(short, assignment, 0, '2026-10-07T01:01:40Z');
  assert.equal(result.workedMinutes, 1);
  assert.equal(result.creditedMinutes, 1);
  const overnight = { time_in: '2026-10-07T14:00:00Z', session_type: 'OPEN_TIME', credit_cutoff_at: '2026-10-07T16:00:00Z',
    pause_history: [{ started_at: '2026-10-07T15:30:00Z', ended_at: '2026-10-08T01:00:00Z' }] };
  const midnight = calculateCredit(overnight, assignment, 0, '2026-10-08T01:00:00Z');
  assert.equal(midnight.creditedMinutes, 90);
  assert.equal(midnight.workedMinutes, 90);
  assert.equal(midnight.completionReason, 'DAY_ENDED');
  assert.equal(midnight.credit_cutoff_at, '2026-10-07T16:00:00.000Z');
});
test('credit stops at the daily cap, requirement or Manila midnight without capping raw work', () => {
  const assignment = { required_hours: 20, completed_hours: 0, remaining_hours: 20 };
  const session = { time_in: now, session_type: 'OPEN_TIME', credit_cutoff_at: '2026-10-07T06:00:00Z' };
  const result = calculateCredit(session, assignment, 180, '2026-10-07T10:00:00Z');
  assert.equal(result.workedMinutes, 540);
  assert.equal(result.creditedMinutes, 300);
  assert.equal(result.completionReason, 'DAILY_LIMIT_REACHED');
  const final = calculateCredit({ ...session, credit_cutoff_at: '2026-10-07T01:00:36Z' }, { required_hours: 1.01, completed_hours: 1, remaining_hours: 0.01 }, 0, '2026-10-07T01:01:00Z');
  assert.equal(final.creditedMinutes, 0.6);
  assert.equal(final.remainingMinutes, 0);
  const overnight = calculateCredit({ ...session, time_in: '2026-10-07T15:00:00Z', credit_cutoff_at: '2026-10-07T16:00:00Z' }, assignment, 0, '2026-10-07T18:00:00Z');
  assert.equal(overnight.creditedMinutes, 60);
  assert.equal(overnight.completionReason, 'DAY_ENDED');
});
