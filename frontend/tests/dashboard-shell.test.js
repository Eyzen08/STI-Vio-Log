import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { validateSignatureFile } from '../src/lib/signatureImage.js'

test('quick actions are role scoped and navigate only within the role portal', () => {
  const source = fs.readFileSync(new URL('../src/components/DashboardQuickActions.jsx', import.meta.url), 'utf8')
  for (const label of ['Add Student', 'Issue Violation', 'Record Attendance', 'Generate Report']) assert.match(source, new RegExp(label))
  assert.doesNotMatch(source, /Review Registrations|pendingRegistrations|\/admin\/registrations/)
  assert.match(source, /STUDENT:[\s\S]*?\/student\/clearance/)
  assert.match(source, /STUDENT:[\s\S]*?\/student\/messages/)
  assert.match(source, /DEPARTMENT_HEAD:[\s\S]*?\/department\/reports/)
  assert.match(source, /DEPARTMENT_HEAD:[\s\S]*?\/department\/notifications/)
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    const expected = ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(role) ? 4 : 5
    assert.equal((source.match(new RegExp(`${role}: \\[([\\s\\S]*?)\\n  \\]`))?.[1].match(/\['/g) || []).length, expected)
  }
})

test('admin dashboard omits registration metrics and keeps additional totals accessible', () => {
  const source = fs.readFileSync(new URL('../src/components/AdminDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /const primaryMetrics = \[/)
  assert.match(source, /View additional totals/)
  assert.match(source, /dashboard-additional-metrics/)
  assert.doesNotMatch(source, /pendingRegistrations|Pending reviews|Student registrations/)
})

test('active attendance sessions fill the dashboard primary column with responsive scrolling', () => {
  const source = fs.readFileSync(new URL('../src/components/AdminDashboard.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  const primary = source.match(/className="admin-dashboard-primary"([\s\S]*?)className="admin-dashboard-secondary"/)?.[1] || ''
  assert.ok(primary.indexOf('Recent violations') < primary.indexOf('Active attendance sessions'))
  assert.match(primary, /visibleActiveSessions\.map/)
  assert.match(primary, /Loading active attendance sessions/)
  assert.match(source, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 1000\)/)
  assert.match(source, /setInterval\(refresh, 15000\)/)
  assert.match(source, /activeSessions\.filter\(isActiveServiceSession\)/)
  assert.match(source, /serviceSessionTiming\(session, now\)/)
  assert.match(primary, /<ActiveSessionTimer session=\{session\} now=\{now\}/)
  assert.match(primary, /data-label="Student"/)
  assert.match(primary, /data-label="Supervising officer"/)
  assert.match(css, /\.active-session-card \.table-wrap \{[^}]*max-height: 20rem;[^}]*overflow: auto;/s)
  assert.match(css, /\.active-session-card thead th \{[^}]*position: sticky;[^}]*top: 0;/s)
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.admin-dashboard-grid \{[^}]*grid-template-columns: 1fr;/s)
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.active-session-card \.table-wrap \{[^}]*max-height: none;[^}]*overflow: visible;/s)
})

test('dashboard hierarchy leads with live metrics and derives the offense chart from records', () => {
  for (const component of ['AdminDashboard.jsx', 'StudentDashboard.jsx', 'DepartmentDashboard.jsx']) {
    const source = fs.readFileSync(new URL(`../src/components/${component}`, import.meta.url), 'utf8')
    assert.ok(source.indexOf('className="stats-grid') < source.indexOf('<DashboardQuickActions'))
  }
  const admin = fs.readFileSync(new URL('../src/components/AdminDashboard.jsx', import.meta.url), 'utf8')
  assert.match(admin, /violations\.filter\(\(violation\) => violation\.offense_indicator_level === item\.level\)/)
  assert.match(admin, /aria-label=\{`\$\{classifiedTotal\} classified violation records`\}/)
  assert.doesNotMatch(admin, /124|Juan Dela Cruz|Maria Lopez/)
})

test('management summaries use the shared SVG metric component instead of font glyphs', () => {
  const metric = fs.readFileSync(new URL('../src/components/ManagementMetric.jsx', import.meta.url), 'utf8')
  assert.match(metric, /<PortalIcon name=\{icon\}/)
  assert.match(metric, /metric-\$\{tone\}/)
  for (const component of ['App.jsx', 'AdminAuditLog.jsx', 'AdminDuplicateReview.jsx', 'AdminClearanceCertificates.jsx']) {
    const prefix = component === 'App.jsx' ? '../src/' : '../src/components/'
    const source = fs.readFileSync(new URL(`${prefix}${component}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /management-metric[^\n]*<i>/)
  }
})

test('discipline workflows keep filters, long tables, and motion accessible', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /table-card:has\(\.management-table-header\) thead th \{[^}]*position: sticky;[^}]*top: 0;/s)
  assert.match(css, /table-card:has\(\.management-table-header\) tbody tr:focus-within/)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?thead th \{[\s\S]*?position: static;/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none;/)
})

test('administration workspaces share compact tabs, dense directories, and responsive comparisons', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.department-officer-page,[\s\S]*?\.admin-settings-page \{[^}]*width: min\(100%, 94rem\);/)
  assert.match(css, /\.main-panel :is\(\.department-officer-tabs, \.review-workspace-tabs\) \{[^}]*border: 1px solid var\(--color-border\);/s)
  assert.match(css, /\.officer-directory,[\s\S]*?\.signature-directory \{[^}]*grid-auto-flow: dense;/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.duplicate-review-grid \{[\s\S]*?grid-template-columns: 1fr;/)
})

test('communication, reporting, dark mode, and accessibility share the final responsive system', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.messages-workspace \{[^}]*grid-template-columns: minmax\(17rem, 0\.7fr\) minmax\(0, 1\.3fr\);/s)
  assert.match(css, /\.message-composer \{[^}]*border-top-color: var\(--color-border\);/s)
  assert.match(css, /\.report-pagination \{[^}]*position: sticky;[^}]*bottom: 0;/s)
  assert.match(css, /\[data-theme='dark'\] :is\(\.messages-workspace,[^}]*background-color: var\(--color-surface\);/s)
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*?grid-template-columns: 1fr;/)
  assert.match(css, /@media \(forced-colors: active\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: 0\.01ms !important;/)
})

test('desktop shell follows the compact attached-reference proportions', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*?grid-template-columns: 12\.5rem minmax\(0, 1fr\);/)
  assert.match(css, /\.portal-dashboard \.stat-card \{[^}]*min-height: 4\.75rem;/s)
  assert.match(css, /\.dashboard-quick-actions button \{[^}]*min-height: 2\.35rem;/s)
  assert.match(css, /\.admin-dashboard-grid \{[^}]*minmax\(0, 1\.7fr\) minmax\(16rem, 0\.72fr\);/s)
  assert.match(css, /\[data-theme='dark'\] \.app-shell:not\(\.auth-shell\) \.sidebar/)
})

test('final portal authority prevents legacy premium rules from overriding the reference shell', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  const authority = css.slice(css.lastIndexOf('Authenticated portal final authority'))
  assert.match(authority, /grid-template-columns: 11\.75rem minmax\(0, 1fr\)/)
  assert.match(authority, /\.sidebar \.brand \{[\s\S]*?min-height: 3\.6rem;[\s\S]*?box-shadow: none;/)
  assert.match(authority, /\.sidebar \.nav-item\.active,[\s\S]*?background: #0878df;[\s\S]*?color: #fff;/)
  assert.match(authority, /\.page-content \{[\s\S]*?padding: 0\.75rem 0\.9rem 1rem;/)
  assert.match(authority, /\.dashboard-quick-actions > div \{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/)
  assert.match(authority, /\.dashboard-card:hover \{[\s\S]*?transform: none;/)
})

test('profile menu resolves readable roles and preserved account routes', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  assert.match(source, /DISCIPLINE_OFFICE: 'Discipline Office'/)
  assert.match(source, /\/student\/account-settings/)
  assert.match(source, /\/department\/account-settings/)
  assert.match(source, /\/admin\/account-settings/)
  assert.doesNotMatch(source, /SYSTEM_ADMIN/)
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
  assert.equal((app.match(/className="management-record-table"/g) || []).length, 2)
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

test('student row actions use a controlled accessible menu on mobile', () => {
  const accountActions = fs.readFileSync(new URL('../src/components/StudentAccountActions.jsx', import.meta.url), 'utf8')
  assert.match(accountActions, /aria-expanded=\{menuOpen\}/)
  assert.match(accountActions, /aria-haspopup="menu"/)
  assert.match(accountActions, /onClick=\{\(\)=>open\('edit'\)\}/)
  assert.match(accountActions, /onClick=\{\(\)=>open\('password'\)\}/)
  assert.match(accountActions, /onClick=\{\(\)=>open\('google'\)\}/)
  assert.doesNotMatch(accountActions, /<details/)
})

test('student and violation legends include the grave offense indicator', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.equal((app.match(/<OffenseIndicator level="GRAVE" label="Grave"\/>/g) || []).length, 2)
})

test('desktop sidebar scrolls vertically without hover-created horizontal overflow', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  const appCss = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(css, /\.sidebar \.nav \{ max-width: 100%; overflow-x: hidden; \}/)
  assert.match(css, /\.sidebar \.nav-item \{[^}]*max-width: 100%;[^}]*box-sizing: border-box;/)
  assert.doesNotMatch(css, /\.sidebar \.nav-item:hover:not\(\.active\)[^{]*\{[^}]*translateX/)
  assert.match(appCss, /sidebar-collapsed \.brand-logo \{ display: none; \}/)
  assert.match(appCss, /sidebar-collapsed \.brand-favicon \{[^}]*display: block;[^}]*object-fit: contain;/s)
  assert.match(appCss, /sidebar-collapsed \.nav-item \{[^}]*width: 100%;[^}]*overflow: visible;/s)
  assert.match(appCss, /sidebar-collapsed \.nav-group-label,[\s\S]*?sidebar-collapsed \.nav-item-label > span \{ display: none !important; \}/)
  assert.match(appCss, /sidebar-collapsed \.nav-pending-badge \{[^}]*position: absolute;/s)
  assert.match(css, /\.sidebar \.nav-item\.active\s*\{[^}]*background:\s*var\(--portal-yellow\);[^}]*color:\s*#08244b;/s)
  assert.match(css, /\.mobile-bottom-nav button\.active\s*\{[^}]*background:\s*var\(--portal-yellow\) !important/s)
})

test('sidebar brand presents the official logo as an integrated lockup', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(app, /alt="STI Vio-Log Discipline Office Portal"\s+width="420"\s+height="236"/)
  assert.match(app, /className="brand-favicon" src="\/favicon-32\.png" alt="STI Vio-Log"/)
  assert.match(css, /\.sidebar \.brand\s*\{[^}]*background:\s*linear-gradient\(145deg, #e9f4ff, #d9eaff\);/s)
  assert.match(css, /\.sidebar \.brand::after\s*\{[^}]*background:\s*var\(--portal-yellow\);/s)
  assert.match(css, /\.sidebar \.brand-logo\s*\{[^}]*mix-blend-mode:\s*multiply;[^}]*transform:\s*scale\(1\.08\);/s)
})

test('desktop sidebar toggle lives in the top bar without clipped positioning', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  const brand = app.match(/<div className="brand">([\s\S]*?)<\/div>/)?.[1] || ''
  const topbarTitle = app.match(/<div className="topbar-title">([\s\S]*?)<form className="topbar-search"/)?.[1] || ''
  assert.doesNotMatch(brand, /sidebar-collapse/)
  assert.match(topbarTitle, /className="sidebar-collapse"[\s\S]*?aria-controls="portal-navigation"[\s\S]*?aria-expanded=\{!isSidebarCollapsed\}/)
  assert.match(topbarTitle, /isSidebarCollapsed \? 'panel-left-open' : 'panel-left-close'/)
  assert.match(css, /\.sidebar-collapse \{[^}]*width: 38px;[^}]*border-radius: 9px !important;/s)
  assert.match(css, /\.sidebar-collapse:focus-visible \{[^}]*outline: 3px solid/s)
  assert.doesNotMatch(css, /\.sidebar-collapse \{[^}]*(?:right:\s*-|position:\s*absolute)/s)
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.sidebar-collapse \{ display: none; \}/)
})

test('topbar search owns one aligned surface and theme-aware focus ring', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.topbar-search \{[^}]*border: 1px solid transparent;[^}]*border-radius: 0\.45rem;/s)
  assert.match(css, /\.main-panel \.topbar-search input \{[^}]*min-height: 0 !important;[^}]*padding: 0 !important;[^}]*border: 0 !important;[^}]*border-radius: 0 !important;[^}]*background: transparent !important;[^}]*box-shadow: none !important;/s)
  assert.match(css, /\.topbar-search:focus-within \{[^}]*border-color: var\(--link-color\) !important;[^}]*box-shadow: 0 0 0 2px color-mix\(in srgb, var\(--link-color\) 22%, transparent\);/s)
  assert.match(css, /\.main-panel \.topbar-search input:focus-visible \{[^}]*outline: 0;[^}]*box-shadow: none;/s)
  assert.match(css, /@media \(forced-colors: active\) \{[\s\S]*?\.topbar-search:focus-within \{[^}]*outline: 2px solid Highlight;/s)
})

test('segmented navigation uses readable light hover and selected states', () => {
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.main-panel :is\(\.review-workspace-tabs,[^}]*button:hover:not\(:disabled\) \{[^}]*background: #edf6ff !important;[^}]*color: #063f7c !important;/s)
  assert.match(css, /button:is\(\.active, \[aria-selected='true'\], \[aria-current='page'\]\) \{[^}]*background: #dceeff !important;[^}]*color: #063b75 !important;/s)
})

test('profile menu provides outside, Escape, navigation, and logout close behavior', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(source, /addEventListener\('click', outside\)/)
  assert.doesNotMatch(source, /pointerdown/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /\[routePath\]/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.match(source, /onLogout\?\.\(\)/)
  assert.match(source, /const activateLogout = \(event\) => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?close\(false\)[\s\S]*?onLogout\?\.\(\)/)
  assert.match(source, /const logoutOnTouch = \(event\) => \{[\s\S]*?lastLogoutTouchRef\.current = Date\.now\(\)[\s\S]*?activateLogout\(event\)/)
  assert.match(source, /const logoutOnClick = \(event\) => \{[\s\S]*?Date\.now\(\) - lastLogoutTouchRef\.current < 750[\s\S]*?return[\s\S]*?activateLogout\(event\)/)
  assert.match(source, /className="profile-logout" onTouchEnd=\{logoutOnTouch\} onClick=\{logoutOnClick\}/)
  assert.match(source, /href=\{profilePath\(user\?\.role\)\}/)
  assert.match(source, /href=\{settingsPath\(user\?\.role\)\}/)
  assert.match(source, /onTouchEnd=\{\(event\) => navigateOnTouch\(event, profilePath\(user\?\.role\)\)\}/)
  assert.match(source, /window\.location\.assign\(new URL\(path, window\.location\.href\)\.href\)/)
  assert.match(source, /aria-haspopup="menu"/)
  assert.match(source, /className="profile-menu-chevron"/)
  assert.match(source, /open \? '⏶' : '⏷'/)
  assert.match(css, /\.profile-menu-popover \{ position: absolute;[^}]*pointer-events: auto;/)
  assert.doesNotMatch(css, /\.profile-menu-popover \{ position: fixed;/)
  assert.match(css, /touch-action: manipulation/)
})

test('mobile profile uses circular initials in the trigger and opened menu', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(app, /profile=\{isStudent \? studentProfile : null\}/)
  assert.match(source, /avatarInitials\(\{ \.\.\.user, \.\.\.profile \}\)/)
  assert.match(css, /\.main-panel \.profile-menu-trigger,[^}]*width: 44px; height: 44px;[^}]*background: transparent !important;[^}]*transform: none !important;/s)
  assert.match(css, /\.profile-menu-trigger \.account-avatar \{ width: 42px; height: 42px; border-radius: 50%/)
  assert.match(css, /\.profile-menu-popover header \.account-avatar \{ width: 42px; height: 42px;[^}]*border-radius: 50%/s)
})

test('mobile header keeps its controls visible and logout forces a clean sign-out', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.topbar \{[\s\S]*?background: linear-gradient\([^}]*!important;/)
  assert.match(css, /\.mobile-menu-button \{[^}]*display: grid !important;[^}]*color: #fff !important;/s)
  assert.match(css, /\.notification-button \{[^}]*color: #fff !important;/s)
    assert.match(app, /const handleLogout = async \(\) => \{[\s\S]*?\/api\/auth\/logout[\s\S]*?clearSession\(\)[\s\S]*?setIsMobileNavOpen\(false\)[\s\S]*?window\.location\.replace\(new URL\('\/login', window\.location\.href\)\.href\)/)
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
