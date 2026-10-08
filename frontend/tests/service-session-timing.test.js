import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceSessionTiming, serverClockTime } from '../src/lib/departmentService.js'

const start = Date.parse('2026-10-07T01:00:00Z')
const session = {time_in:new Date(start).toISOString(),session_type:'FIXED',selected_duration_minutes:120,credit_cutoff_at:new Date(start+8*3600000).toISOString(),completed_today_minutes:0}
test('fixed countdown switches to overtime before the credit cutoff', () => {
  const timing = serviceSessionTiming(session,start+125*60000)
  assert.equal(timing.remainingSeconds,0)
  assert.equal(timing.elapsedSeconds,7500)
  assert.equal(timing.additionalSeconds,300)
  assert.equal(timing.targetCompleted,true)
})
test('Open Time freezes at the remaining daily allowance', () => {
  const open = {...session,session_type:'OPEN_TIME',selected_duration_minutes:null,completed_today_minutes:120,credit_cutoff_at:new Date(start+6*3600000).toISOString()}
  const before = serviceSessionTiming(open,start+6*3600000-1000)
  assert.equal(before.elapsedSeconds,6*3600-1)
  assert.equal(before.dailyRemainingSeconds,1)
  assert.equal(before.creditRemainingSeconds,1)
  assert.equal(before.limitReached,false)
  for (const hours of [6,7]) {
    const timing = serviceSessionTiming(open,start+hours*3600000)
    assert.equal(timing.elapsedSeconds,6*3600)
    assert.equal(timing.dailyRemainingSeconds,0)
    assert.equal(timing.creditRemainingSeconds,0)
    assert.equal(timing.limitReached,true)
  }
})

test('fixed elapsed time and overtime freeze at the daily cutoff', () => {
  const fixed = {...session,completed_today_minutes:120,credit_cutoff_at:new Date(start+6*3600000).toISOString()}
  for (const hours of [6,7]) {
    const timing = serviceSessionTiming(fixed,start+hours*3600000)
    assert.equal(timing.elapsedSeconds,6*3600)
    assert.equal(timing.additionalSeconds,4*3600)
    assert.equal(timing.remainingSeconds,0)
    assert.equal(timing.targetCompleted,true)
  }
})

test('displayed elapsed time respects earlier requirement and Manila midnight cutoffs', () => {
  for (const [timeIn,cutoff,seconds] of [
    ['2026-10-07T01:00:00Z','2026-10-07T01:00:36Z',36],
    ['2026-10-07T15:00:00Z','2026-10-07T16:00:00Z',3600]
  ]) {
    const open = {...session,time_in:timeIn,session_type:'OPEN_TIME',selected_duration_minutes:null,credit_cutoff_at:cutoff}
    const timing = serviceSessionTiming(open,Date.parse(cutoff)+3600000)
    assert.equal(timing.elapsedSeconds,seconds)
    assert.equal(timing.creditRemainingSeconds,0)
    assert.equal(timing.limitReached,true)
  }
})
test('clock is anchored to server time and monotonic elapsed, independent of wall clock', () => {
  assert.equal(serverClockTime(new Date(start).toISOString(),1000,2500),start+1500)
  assert.equal(serverClockTime(new Date(start).toISOString(),2500,1000),start)
})

test('fractional final target reaches zero without negative remaining time',()=>{
  const timing=serviceSessionTiming({...session,selected_duration_minutes:55.00002,credit_cutoff_at:new Date(start+3300002).toISOString()},start+3600000)
  assert.equal(timing.targetCompleted,true)
  assert.equal(timing.remainingSeconds,0)
})
