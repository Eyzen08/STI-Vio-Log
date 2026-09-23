import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const clearance = fs.readFileSync(new URL('../src/components/AdminClearanceCertificates.jsx', import.meta.url), 'utf8')
const portalStyles = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')

test('Clearance Management exposes three URL-backed accessible panels', () => {
  for (const label of ['Student Clearance Status', 'E-Signature Management', 'Certificate History']) assert.ok(clearance.includes(label))
  assert.match(clearance, /role="tablist"/)
  assert.match(clearance, /role="tab"/)
  assert.match(clearance, /role="tabpanel"/)
  assert.match(clearance, /URLSearchParams\(window\.location\.search\)/)
  assert.match(clearance, /window\.history\.pushState/)
  assert.match(clearance, /window\.history\.replaceState/)
  assert.match(clearance, /popstate/)
  assert.match(clearance, /ArrowRight/)
  assert.match(clearance, /ArrowLeft/)
  assert.doesNotMatch(clearance, />Previous<|>Next</)
})

test('Clearance panels render one selected workspace while retaining existing actions', () => {
  assert.match(clearance, /activePanel === 'students'/)
  assert.match(clearance, /activePanel === 'signatures'/)
  assert.match(clearance, /activePanel === 'history'/)
  for (const action of ['Approve Clearance', 'Review &amp; Issue Certificate', 'Save Signature', 'Download', 'Email', 'Revoke']) assert.ok(clearance.includes(action))
})

test('Clearance tabs stay visible and long panel collections scroll internally', () => {
  assert.match(portalStyles, /\.clearance-panel-tabs \{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s)
  assert.doesNotMatch(portalStyles, /\.clearance-panel-tabs \{[^}]*overflow-x:auto/s)
  assert.match(portalStyles, /\[data-panel='students'\] \.certificate-student-list \{[^}]*max-height:[^;]+;[^}]*overflow:auto/s)
  assert.match(portalStyles, /\[data-panel='signatures'\] \.signature-directory \{[^}]*max-height:[^;]+;[^}]*overflow:auto/s)
  assert.match(portalStyles, /\[data-panel='history'\] \.table-wrap \{[^}]*max-height:[^;]+;[^}]*overflow:auto/s)
  assert.match(portalStyles, /\[data-panel='history'\] \.table-wrap thead th \{[^}]*position:sticky/s)
})

test('Clearance Management compacts cleanly into a mobile workspace', () => {
  assert.match(portalStyles, /@media \(max-width:767px\)[\s\S]*?\.certificate-admin > \.management-metrics \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(portalStyles, /\.main-panel \.clearance-panel-tabs > button \{[^}]*min-height:4rem[^}]*flex-direction:column/s)
  assert.match(portalStyles, /\[data-panel='students'\] \.certificate-student-list,[\s\S]*?max-height:none; overflow:visible/)
  assert.match(portalStyles, /@media \(max-width:340px\)[\s\S]*?\.certificate-admin > \.management-metrics \{ grid-template-columns:1fr/)
})
