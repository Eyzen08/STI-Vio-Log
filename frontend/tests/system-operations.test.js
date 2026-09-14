import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const dashboard=fs.readFileSync(new URL('../src/components/SystemDashboard.jsx',import.meta.url),'utf8')
const actions=fs.readFileSync(new URL('../src/components/HighRiskActionPanel.jsx',import.meta.url),'utf8')
test('system operations uses account search and two-person requests instead of raw direct actions',()=>{assert.match(dashboard,/api\/system\/accounts\?search=/);assert.match(dashboard,/api\/high-risk-actions\/step-up/);assert.match(dashboard,/awaiting Discipline Administrator approval/);assert.doesNotMatch(dashboard,/api\/system\/accounts\/\$\{accountAction/)})
test('system operations exposes refreshable health and event filters',()=>{assert.match(dashboard,/Component health/);assert.match(dashboard,/Refresh checks/);assert.match(dashboard,/Search events/);assert.match(dashboard,/Apply filters/)})
test('high-risk queue separates discipline approval from system execution',()=>{assert.match(actions,/role==='DISCIPLINE_ADMIN'/);assert.match(actions,/role==='SYSTEM_ADMIN'/);assert.match(actions,/Current password/);assert.match(actions,/Approval expires after 15 minutes/)})
test('step-up failures identify the signed-in account and discard a mismatched autofill',()=>{assert.match(dashboard,/user\?\.username/);assert.match(dashboard,/setAttribute\('autocomplete','off'\)/);assert.match(dashboard,/password:''/);assert.match(actions,/user\?\.username/);assert.match(actions,/setPassword\(''\)/)})
