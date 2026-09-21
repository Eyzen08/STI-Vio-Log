import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard=fs.readFileSync(new URL('../src/components/SystemDashboard.jsx',import.meta.url),'utf8')
const routes=fs.readFileSync(new URL('../src/lib/routes.js',import.meta.url),'utf8')

test('unified System Monitoring uses account search and one direct password-confirmed action',()=>{
  assert.match(dashboard,/api\/system\/accounts\?search=/)
  assert.match(dashboard,/api\/high-risk-actions\/step-up/)
  assert.match(dashboard,/api\/high-risk-actions\/execute/)
  assert.doesNotMatch(dashboard,/awaiting Discipline Administrator approval|two-person/i)
  assert.match(dashboard,/Account recovery and lock/)
  assert.match(dashboard,/can_lock/);assert.match(dashboard,/can_recover/)
  assert.match(dashboard,/temporary-credential/);assert.match(dashboard,/navigator\.clipboard\.writeText/)
})

test('System Monitoring exposes refreshable health and event filters',()=>{
  assert.match(dashboard,/Component health/);assert.match(dashboard,/Refresh checks/);assert.match(dashboard,/Search events/);assert.match(dashboard,/Apply filters/)
  assert.match(dashboard,/PlatformMark/);assert.match(dashboard,/Supabase/);assert.match(dashboard,/Socket\.IO/)
})

test('step-up failures identify the signed-in account and clear mismatched autofill',()=>{
  assert.match(dashboard,/user\?\.username/);assert.match(dashboard,/name="administrator_step_up_password" autoComplete="off"/);assert.match(dashboard,/password:''/)
})

test('only Discipline Admin receives the System Monitoring route',()=>{
  assert.match(routes,/\/admin\/system-monitoring[^\n]+DISCIPLINE_ADMIN/)
  assert.doesNotMatch(routes,/SYSTEM_ADMIN|support-access|action-requests/)
})
