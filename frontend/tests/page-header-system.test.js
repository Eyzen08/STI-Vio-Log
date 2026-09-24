import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const portal = read('../src/styles/portal-system.css')

test('authenticated route headers use the shared page-header class', () => {
  const sources = [
    '../src/App.jsx',
    '../src/components/AccountSecuritySettings.jsx',
    '../src/components/AdminAccountSettings.jsx',
    '../src/components/AdminActiveAttendance.jsx',
    '../src/components/AdminAuditLog.jsx',
    '../src/components/AdminClearanceCertificates.jsx',
    '../src/components/AdminDashboard.jsx',
    '../src/components/AdminDepartmentOfficers.jsx',
    '../src/components/AdminDuplicateReview.jsx',
    '../src/components/DepartmentCommunityService.jsx',
    '../src/components/DepartmentDashboard.jsx',
    '../src/components/DepartmentDtr.jsx',
    '../src/components/DepartmentNonCompliance.jsx',
    '../src/components/DepartmentQrScanner.jsx',
    '../src/components/DepartmentReports.jsx',
    '../src/components/DepartmentStudents.jsx',
    '../src/components/MessagesPage.jsx',
    '../src/components/StaffProfile.jsx',
    '../src/components/StudentClearance.jsx',
    '../src/components/StudentCommunityService.jsx',
    '../src/components/StudentDashboard.jsx',
    '../src/components/StudentNotifications.jsx',
    '../src/components/StudentProfile.jsx',
    '../src/components/StudentQr.jsx',
    '../src/components/StudentViolations.jsx',
    '../src/components/SystemDashboard.jsx'
  ]

  for (const source of sources) assert.match(read(source), /portal-page-header/, source)
})

test('shared page headers are card surfaces across themes and viewports', () => {
  assert.match(portal, /\.portal-page-header\s*\{[^}]*border:[^;]+;[^}]*border-radius:[^;]+;[^}]*box-shadow:/s)
  assert.match(portal, /:root\[data-theme='dark'\] \.portal-page-header\s*\{[^}]*background: var\(--surface-raised\) !important;/s)
  assert.match(portal, /@media \(max-width: 767px\)[\s\S]*?\.portal-page-header\s*\{[^}]*flex-direction: column;[^}]*align-items: stretch;/s)
  assert.match(portal, /@media \(max-width: 390px\)[\s\S]*?\.portal-page-header \.page-breadcrumb\s*\{[^}]*display: none;/s)
  assert.match(portal, /\.portal-page-header > :is\(button, \.primary-action, \.messages-new-button\)\s*\{[^}]*width: 100%;/s)
  assert.match(portal, /\.main-panel--messages \.messages-page-heading\.portal-page-header\s*\{[^}]*flex-direction: column;[^}]*align-items: stretch;/s)
  assert.match(portal, /\.main-panel--messages \.messages-page-heading\.portal-page-header \.messages-new-button\s*\{[^}]*width: 100%;[^}]*min-height: 2\.75rem;[^}]*flex: 0 0 auto;/s)
})

test('student and staff profile initials remain compact square avatars', () => {
  const studentProfile = read('../src/components/StudentProfile.jsx')
  const staffProfile = read('../src/components/StaffProfile.jsx')

  assert.match(studentProfile, /className="profile-avatar"[^>]*>\{initials\}/)
  assert.match(staffProfile, /className="profile-avatar"[^>]*>\{initials\}/)
  assert.match(portal, /\.profile-card > \.portal-page-header > \.profile-avatar\s*\{[^}]*width: 4\.5rem;[^}]*height: 4\.5rem;[^}]*flex: 0 0 4\.5rem;[^}]*align-self: center;/s)
  assert.match(portal, /@media \(max-width: 767px\)[\s\S]*?\.profile-card > \.portal-page-header > \.profile-avatar\s*\{[^}]*width: 3\.5rem;[^}]*height: 3\.5rem;[^}]*flex-basis: 3\.5rem;[^}]*align-self: flex-start;/s)
})

test('light department page headers override the legacy pale hero text', () => {
  assert.match(portal, /:root:not\(\[data-theme='dark'\]\) \.department-welcome\.portal-page-header \.eyebrow \{ color: var\(--color-text-secondary\) !important; \}/)
  assert.match(portal, /:root:not\(\[data-theme='dark'\]\) \.department-welcome\.portal-page-header p:not\(\.eyebrow\) \{ color: var\(--color-text-secondary\) !important; \}/)
  assert.match(portal, /:root\[data-theme='dark'\] \.department-welcome\.portal-page-header :is\(\.eyebrow,p:not\(\.eyebrow\)\) \{ color: var\(--text-secondary\) !important; \}/)
})

test('dark account settings keeps password requirements on themed surfaces', () => {
  assert.match(portal, /:root\[data-theme='dark'\] \.account-settings-page \.password-requirements\s*\{[^}]*background: var\(--surface-nested\) !important;[^}]*color: var\(--text-primary\) !important;/s)
  assert.match(portal, /\.account-settings-page \.password-requirements \.valid\s*\{[^}]*color: var\(--status-success-text\) !important;/s)
  assert.match(portal, /\.account-settings-page \.password-requirements \.invalid\s*\{[^}]*color: var\(--status-danger-text\) !important;/s)
})

test('public and authentication pages do not use portal page headers', () => {
  for (const source of ['../src/components/LoginPage.jsx', '../src/components/PublicPolicyPage.jsx']) {
    assert.doesNotMatch(read(source), /portal-page-header/)
  }
})
