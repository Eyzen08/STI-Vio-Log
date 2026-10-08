import { readPortalStyles } from './helpers/portalStyles.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard=fs.readFileSync(new URL('../src/components/SystemDashboard.jsx',import.meta.url),'utf8')
const routes=fs.readFileSync(new URL('../src/lib/routes.js',import.meta.url),'utf8')
const portalStyles=readPortalStyles()

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

test('System Monitoring presents four URL-backed accessible panels',()=>{
  assert.match(dashboard,/overview.*security.*authentication.*accounts/s)
  for(const label of ['Overview & Health','Security Events','Authentication Activity','Account Controls'])assert.match(dashboard,new RegExp(label.replace('&','&')))
  assert.match(dashboard,/role="tablist"/);assert.match(dashboard,/role="tabpanel"/)
  assert.match(dashboard,/URLSearchParams\(window\.location\.search\)/)
  assert.match(dashboard,/window\.history\.pushState/);assert.match(dashboard,/popstate/)
  assert.doesNotMatch(dashboard,/monitoring-slide-controls|>Previous<|>Next<|Step \{activePanelIndex\+1\} of/)
  assert.match(dashboard,/ArrowRight/);assert.match(dashboard,/ArrowLeft/)
})

test('all four monitoring tabs stay visible without horizontal scrolling',()=>{
  assert.match(portalStyles,/\.monitoring-panel-tabs \{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s)
  assert.doesNotMatch(portalStyles,/\.monitoring-panel-tabs \{[^}]*overflow-x:auto/s)
  assert.match(portalStyles,/@media \(max-width:700px\) \{[\s\S]*?\.monitoring-panel-tabs \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
})

test('security and authentication records expose complete mobile card labels',()=>{
  assert.equal((dashboard.match(/className="responsive-record-table system-event-table"/g)||[]).length,2)
  for(const label of ['Time','Actor','Account','Action','Target','Result'])assert.match(dashboard,new RegExp(`data-label="${label}"`))
  assert.match(portalStyles,/\.responsive-record-table\.system-event-table tr \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s)
  assert.match(portalStyles,/\.responsive-record-table\.system-event-table \.status-badge \{[^}]*white-space:nowrap[^}]*word-break:keep-all/s)
  assert.match(portalStyles,/\.monitoring-slide :is\([^}]+\) \.table-wrap \{[^}]*max-height:none[^}]*overflow:visible/s)
})

test('monitoring tabs use a compact flat boundary',()=>{
  assert.match(portalStyles,/\.main-panel \.monitoring-panel-tabs > button \{[^}]*min-height:2\.75rem[^}]*border:1px solid var\(--border-subtle\)[^}]*box-shadow:none/s)
  assert.match(portalStyles,/\.monitoring-panel-tabs > button:not\(\[aria-selected='true'\]\) \{[^}]*border-color:var\(--border-strong\) !important[^}]*background:var\(--surface-raised\) !important/s)
})

test('slide workspace preserves compact summary card styling after nesting',()=>{
  assert.match(portalStyles,/\.monitoring-slide-scroll > \.stats-grid \.stat-card \{/)
  assert.match(portalStyles,/grid-template-columns:2\.75rem minmax\(0,1fr\)/)
  assert.match(portalStyles,/\.stat-card i \{[^}]*width:2\.75rem; height:2\.75rem/s)
  assert.match(portalStyles,/\.monitoring-slide-scroll > \.stats-grid \.stat-card strong \{/)
})

test('active slide grows naturally instead of clipping inside a fixed viewport',()=>{
  assert.match(portalStyles,/\.system-dashboard \{[^}]*overflow:visible/s)
  assert.match(portalStyles,/\.monitoring-slide-workspace \{[^}]*overflow:visible/s)
  assert.match(portalStyles,/\.monitoring-slide-scroll \{[^}]*overflow:visible[^}]*box-sizing:border-box/s)
  assert.doesNotMatch(portalStyles,/\.system-dashboard \{[^}]*100dvh/s)
})

test('overview dependency cards use an adaptive wrapping grid',()=>{
  assert.match(portalStyles,/\[data-panel='overview'\] \.component-health-grid \{ grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,13rem\),1fr\)\)/)
  assert.match(portalStyles,/\[data-panel='overview'\] \.component-health-card:is/)
})

test('account controls grow naturally while the directory remains bounded',()=>{
  assert.match(portalStyles,/\.monitoring-slide-title \{[^}]*position:absolute/s)
  assert.doesNotMatch(portalStyles,/height:15\.75rem/)
  assert.match(portalStyles,/\[data-panel='accounts'\] \.account-directory-panel \{[^}]*max-height:24rem/s)
  assert.match(portalStyles,/\[data-panel='accounts'\] \.account-action-form textarea \{ min-height:4\.25rem/)
})

test('account search fills its panel and status badges remain secondary',()=>{
  assert.match(portalStyles,/\.account-directory-search input \{[^}]*width:100%; min-width:0/s)
  assert.match(portalStyles,/\.account-action-results b \{[^}]*font-size:var\(--text-xs\)[^}]*text-transform:none/s)
})

test('recovery credentials use readable dark-theme surfaces and text',()=>{
  assert.match(portalStyles,/:root\[data-theme='dark'\] \.system-dashboard \.temporary-credential \{[^}]*background:var\(--surface-nested\)[^}]*color:var\(--text-primary\)/s)
  assert.match(portalStyles,/\.temporary-credential :is\(span,small\) \{ color:var\(--text-secondary\)/)
})

test('dark dependency latency and remediation retain semantic contrast',()=>{
  assert.match(portalStyles,/\.component-health-card > p b \{ color:var\(--text-primary\) !important;/)
  assert.match(portalStyles,/\.component-health-card \.component-remediation \{[^}]*background:var\(--status-warning-surface\)[^}]*color:var\(--status-warning-text\)/s)
})

test('step-up failures identify the signed-in account and clear mismatched autofill',()=>{
  assert.match(dashboard,/user\?\.username/);assert.match(dashboard,/name="administrator_step_up_password" autoComplete="off"/);assert.match(dashboard,/password:''/)
})

test('only Discipline Admin receives the System Monitoring route',()=>{
  assert.match(routes,/\/admin\/system-monitoring[^\n]+DISCIPLINE_ADMIN/)
  assert.doesNotMatch(routes,/SYSTEM_ADMIN|support-access|action-requests/)
})
