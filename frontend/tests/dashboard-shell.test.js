import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { validateSignatureFile } from '../src/lib/signatureImage.js'

test('quick actions are role scoped and navigate only within the role portal', () => {
  const source = fs.readFileSync(new URL('../src/components/DashboardQuickActions.jsx', import.meta.url), 'utf8')
  for (const label of ['Add Student', 'Issue Violation', 'Record Attendance', 'Review Registrations', 'Generate Report']) assert.match(source, new RegExp(label))
  assert.match(source, /STUDENT:[\s\S]*?\/student\/clearance/)
  assert.match(source, /DEPARTMENT_HEAD:[\s\S]*?\/department\/reports/)
})

test('admin dashboard prioritizes four operational metrics and keeps additional totals accessible', () => {
  const source = fs.readFileSync(new URL('../src/components/AdminDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /const primaryMetrics = \[/)
  assert.match(source, /View additional totals/)
  assert.match(source, /dashboard-additional-metrics/)
})

test('profile menu resolves readable roles and preserved account routes', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  assert.match(source, /DISCIPLINE_OFFICE: 'Discipline Office'/)
  assert.match(source, /\/student\/account-settings/)
  assert.match(source, /\/department\/account-settings/)
  assert.match(source, /\/admin\/account-settings/)
  assert.match(source, /SYSTEM_ADMIN: '\/system\/account-settings'/)
  assert.match(source, /SYSTEM_ADMIN: '\/system\/profile'/)
  assert.match(source, /DISCIPLINE_OFFICE: '\/admin\/profile'/)
  assert.match(source, /DEPARTMENT_HEAD: '\/department\/profile'/)
  assert.match(source, /STUDENT: '\/student\/profile'/)
  assert.match(source, /View Profile/)
})

test('mobile shell exposes real branding, scoped directory search, and the system dashboard', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /className="mobile-brand"/)
  assert.match(source, /aria-label="STI Vio-Log home"/)
  assert.match(source, /\['Dashboard', 'System Dashboard'\]\.includes\(view\)/)
  assert.match(source, /\(isAdmin \|\| isDepartmentHead\).*className="topbar-search"/s)
  assert.doesNotMatch(source, /topbar-search::before/)
})

test('primary management tables expose labeled mobile record cards', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.equal((app.match(/className="management-record-table"/g) || []).length, 3)
  for (const label of ['Student', 'Status', 'Actions', 'Service progress']) assert.match(app, new RegExp(`data-label="${label}"`))
  assert.match(css, /\.management-record-table td::before/)
  assert.match(css, /content: attr\(data-label\)/)
  assert.match(css, /\.management-record-table \.table-actions \{[^}]*flex-direction: row !important/s)
})

test('guardian contact action keeps its phone icon aligned with its label', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(app, /className="secondary-button guardian-contact-button"[\s\S]*?<PortalIcon name="phone"\/><span>Guardian Contact<\/span>/)
  assert.match(css, /\.table-actions \.guardian-contact-button \{[^}]*display: inline-flex;[^}]*align-items: center;[^}]*gap: 6px;/s)
  assert.match(css, /\.table-actions \.guardian-contact-button svg \{[^}]*flex: 0 0 16px;/s)
})

test('administrative forms use aligned labels and consistent enhanced dropdowns', () => {
  const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  const accountActions = fs.readFileSync(new URL('../src/components/StudentAccountActions.jsx', import.meta.url), 'utf8')
  const scanner = fs.readFileSync(new URL('../src/components/DepartmentQrScanner.jsx', import.meta.url), 'utf8')
  assert.match(css, /\.main-panel select \{[^}]*appearance: none;[^}]*color-scheme: light;[^}]*background-image:/s)
  assert.match(css, /\.student-form-grid > label \{[^}]*display: grid;/s)
  assert.match(accountActions, /className="student-form account-action-form"/)
  assert.match(accountActions, /className="account-reason-field"/)
  assert.match(scanner, /className="record-field-label">Attendance note <small>Optional<\/small>/)
})

test('student and violation legends include the grave offense indicator', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.equal((app.match(/<OffenseIndicator level="GRAVE" label="Grave"\/>/g) || []).length, 2)
})

test('segmented navigation uses readable light hover and selected states', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.main-panel :is\(\.review-workspace-tabs,[^}]*button:hover:not\(:disabled\) \{[^}]*background: #edf6ff !important;[^}]*color: #063f7c !important;/s)
  assert.match(css, /button:is\(\.active, \[aria-selected='true'\], \[aria-current='page'\]\) \{[^}]*background: #dceeff !important;[^}]*color: #063b75 !important;/s)
})

test('profile menu provides outside, Escape, navigation, and logout close behavior', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(source, /pointerdown/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /\[routePath\]/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /onLogout\?\.\(\)/)
  assert.match(source, /href="\/login\?logout=1"/)
  assert.match(source, /href=\{profilePath\(user\?\.role\)\}/)
  assert.match(source, /href=\{settingsPath\(user\?\.role\)\}/)
  assert.match(source, /aria-haspopup="menu"/)
  assert.match(css, /\.profile-menu-popover \{ position: absolute;[^}]*pointer-events: auto;/)
  assert.doesNotMatch(css, /\.profile-menu-popover \{ position: fixed;/)
  assert.match(css, /touch-action: manipulation/)
})

test('mobile profile uses circular initials in the trigger and opened menu', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.profile-menu-trigger \{ width: 44px; height: 44px;/)
  assert.match(css, /\.profile-menu-trigger \.account-avatar \{ width: 36px; height: 36px; border-radius: 50%/)
  assert.match(css, /\.profile-menu-popover header \.account-avatar \{ width: 42px; height: 42px;[^}]*border-radius: 50%/s)
})

test('mobile header keeps its controls visible and logout forces a clean sign-out', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.topbar \{[\s\S]*?background: linear-gradient\([^}]*!important;/)
  assert.match(css, /\.mobile-menu-button \{[^}]*display: grid !important;[^}]*color: #fff !important;/s)
  assert.match(css, /\.notification-button \{[^}]*color: #fff !important;/s)
  assert.match(app, /const handleLogout = \(\) => \{[\s\S]*?clearSession\(\)[\s\S]*?setIsMobileNavOpen\(false\)[\s\S]*?window\.location\.replace\(new URL\('\/login', window\.location\.href\)\.href\)/)
  assert.match(app, /new URLSearchParams\(window\.location\.search\)[\s\S]*?get\('logout'\) === '1'[\s\S]*?clearSession\(\)/)
})

test('signature image validation accepts only PNG or JPEG up to 1 MB', () => {
  assert.equal(validateSignatureFile({ type: 'image/png', size: 1024 }), '')
  assert.equal(validateSignatureFile({ type: 'image/jpeg', size: 1024 * 1024 }), '')
  assert.match(validateSignatureFile({ type: 'image/svg+xml', size: 10 }), /PNG or JPEG/)
  assert.match(validateSignatureFile({ type: 'image/png', size: 1024 * 1024 + 1 }), /1 MB/)
})

test('clearance renders the validated certificate workspace before legacy state', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const directWorkspace = source.indexOf("if (activeView === 'Clearance') return <AdminClearanceCertificates")
  const legacyForm = source.indexOf('Clearance Record')
  assert.ok(directWorkspace > -1)
  assert.ok(legacyForm === -1 || directWorkspace < legacyForm)
})
