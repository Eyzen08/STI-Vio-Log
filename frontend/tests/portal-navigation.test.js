import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { iconNameForView, mobileNavItemsFor, mobileNavLabel, sidebarNavigationFor, sidebarGroupForPath, sidebarTooltipFor } from '../src/lib/portalNavigation.js'
import { APP_ROUTES, getHomePath, getNavItems, resolveRoute } from '../src/lib/routes.js'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

test('role navigation uses meaningful visual categories and icons', () => {
  assert.equal(iconNameForView('Dashboard'), 'dashboard')
  assert.equal(iconNameForView('My Violations'), 'violations')
  assert.equal(iconNameForView('QR Scan'), 'qr')
  assert.equal(iconNameForView('Community Service'), 'service')
  assert.equal(iconNameForView('Active Attendance'), 'clock')
  assert.match(appSource, /className="nav-group"/)
  assert.match(appSource, /nav-group-toggle/)
})

const sidebarPages = (entries) => entries.flatMap((entry) => entry.type === 'group' ? entry.items : [entry])
const sidebarLabels = (role) => sidebarNavigationFor(role).map((entry) => entry.type === 'group' ? [entry.label, entry.items.map((item) => item.label)] : entry.label)

test('sidebar tooltips describe every permitted item with the approved copy', () => {
  const expected = {
    Dashboard: 'View discipline overview', Students: 'Manage student records', Discipline: 'View discipline modules',
    Violations: 'Add student violation', 'Active Attendance': 'Monitor active attendance', 'Community Service': 'Manage community service',
    'QR Scan': 'Scan attendance QR code', Clearance: 'Manage student clearance', Messages: 'View student messages', Notifications: 'View your notifications',
    Reports: 'Generate discipline reports', 'System & Management': 'Manage system settings', Logout: 'Sign out of STI Vio-Log',
    'Departments & Officer Accounts': 'Manage departments and officers', 'Duplicate Review': 'Review duplicate records',
    'System Monitoring': 'Monitor system activity', Settings: 'Configure system settings',
    'Assigned Students': 'View assigned student records', Attendance: 'Review attendance records',
    'Service Results': 'Review service results', 'Follow-up': 'Review non-compliance follow-ups',
    'My Profile': 'View your profile', 'My Violations': 'View your violations', 'My Service': 'View your service progress',
    'My QR': 'View your QR code', 'My Clearance': 'View your clearance', 'Audit Log': 'Review discipline audit log',
    'Analytics & Trends': 'Explore discipline trends'
  }
  for (const [label, description] of Object.entries(expected)) assert.equal(sidebarTooltipFor(label), description)
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    for (const entry of sidebarNavigationFor(role)) {
      assert.ok(sidebarTooltipFor(entry.label), `${role}: ${entry.label}`)
      if (entry.type === 'group') for (const item of entry.items) assert.ok(sidebarTooltipFor(item.label), `${role}: ${item.label}`)
    }
  }
})

test('administrator sidebar follows the requested hierarchy and child order', () => {
  assert.deepEqual(sidebarLabels('DISCIPLINE_ADMIN'), [
    'Dashboard', 'Students',
    ['Discipline', ['Violations', 'Active Attendance', 'Community Service', 'QR Scan', 'Clearance']],
    'Messages', 'Notifications', ['Reports', ['Reports', 'Audit Log', 'Analytics & Trends']],
    ['System & Management', ['Departments & Officer Accounts', 'Duplicate Review', 'System Monitoring', 'Settings']]
  ])
  assert.deepEqual(sidebarLabels('DISCIPLINE_OFFICE'), [
    'Dashboard', 'Students',
    ['Discipline', ['Violations', 'Active Attendance', 'Community Service', 'QR Scan', 'Clearance']],
    'Messages', 'Notifications', ['Reports', ['Reports', 'Analytics & Trends']], ['System & Management', ['Settings']]
  ])
})

test('department and student sidebars retain their role-specific pages and labels', () => {
  assert.deepEqual(sidebarLabels('DEPARTMENT_HEAD'), [
    'Dashboard', 'Assigned Students', ['Discipline', ['Attendance', 'Service Results', 'QR Scan', 'Follow-up']],
    'Notifications', ['Reports', ['Reports']], ['System & Management', ['Settings']]
  ])
  assert.deepEqual(sidebarLabels('STUDENT'), [
    'Dashboard', 'My Profile', ['Discipline', ['My Violations', 'My Service', 'My QR', 'My Clearance']],
    'Messages', 'Notifications', ['System & Management', ['Settings']]
  ])
})

test('sidebar keeps each permitted page once, adds only authorized Settings, and omits empty groups', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    const entries = sidebarNavigationFor(role)
    const pages = sidebarPages(entries)
    const expected = [...getNavItems(role),
      APP_ROUTES.find((route) => route.view === 'Account Settings' && route.roles.includes(role))]
    assert.deepEqual(pages.map((item) => item.path).sort(), expected.map((item) => item.path).sort())
    assert.equal(new Set(pages.map((item) => item.path)).size, pages.length)
    assert.ok(entries.every((entry) => entry.type !== 'group' || entry.items.length > 0))
    for (const item of pages) assert.equal(resolveRoute(item.path, role).status, 'allowed')
    const settings = pages.find((item) => item.label === 'Settings')
    assert.equal(settings.view, 'Account Settings')
    assert.equal(APP_ROUTES.find((route) => route.path === settings.path).label, 'Account Settings')
    assert.equal(getNavItems(role).some((item) => item.view === 'Account Settings'), false)
  }
  assert.deepEqual(sidebarNavigationFor('SYSTEM_ADMIN'), [])
  assert.deepEqual(sidebarNavigationFor(), [])
})

test('sidebar route grouping recognizes every child and keeps direct pages independent', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    const entries = sidebarNavigationFor(role)
    for (const entry of entries) {
      if (entry.type === 'group') {
        for (const item of entry.items) assert.equal(sidebarGroupForPath(entries, item.path), entry.id)
      } else {
        assert.equal(sidebarGroupForPath(entries, entry.path), null)
      }
    }
    assert.equal(sidebarGroupForPath(entries, '/unknown'), null)
    assert.equal(sidebarGroupForPath(entries, '/admin/registrations'), null)
  }
  assert.equal(sidebarGroupForPath(sidebarNavigationFor('DISCIPLINE_OFFICE'), '/admin/audit-log'), null)
  assert.equal(resolveRoute('/admin/analytics', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/analytics', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/analytics', 'DEPARTMENT_HEAD').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/analytics', 'STUDENT').status, 'unauthorized')
  assert.equal(sidebarGroupForPath(sidebarNavigationFor('STUDENT'), '/admin/violations'), null)
})

test('notifications appear once in each authorized sidebar and remain reachable from the bell', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    const notification = getNavItems(role).find((item) => item.view === 'Notifications')
    assert.ok(notification)
    assert.equal(resolveRoute(notification.path, role).status, 'allowed')
    assert.deepEqual(sidebarPages(sidebarNavigationFor(role)).filter((item) => item.view === 'Notifications').map((item) => item.path), [notification.path])
    assert.equal(mobileNavItemsFor(getNavItems(role), role).some((item) => item.view === 'Notifications'), false)
  }
  assert.match(appSource, /className="notification-button"[^>]+onClick=\{\(\)=>navigateTo\(isStudent\?'\/student\/notifications'/)
})

test('sidebar exposes accessible disclosure state and synchronizes groups only on route or role changes', () => {
  assert.match(appSource, /setOpenSidebarGroup\(activeSidebarGroup\)[\s\S]*?\[routePath, user\?\.role, activeSidebarGroup\]/)
  assert.match(appSource, /aria-expanded=\{expanded\}/)
  assert.match(appSource, /aria-controls=\{`sidebar-\$\{entry.id\}-pages`\}/)
  assert.match(appSource, /hidden=\{!expanded\}/)
  assert.match(appSource, /aria-current=\{routePath === item.path \? 'page' : undefined\}/)
  assert.match(appSource, /if \(isSidebarIconRail\) \{\s*setIsSidebarCollapsed\(false\)\s*setOpenSidebarGroup\(entry.id\)/)
  assert.match(appSource, /setOpenSidebarGroup\(\(current\) => current === entry.id \? null : entry.id\)/)
  assert.match(appSource, /<\/nav>\s*<div className="nav-account-actions">[\s\S]*?onClick=\{requestLogout\}/)
})

test('department mobile navigation places Service after QR Scan', () => {
  const items = mobileNavItemsFor(getNavItems('DEPARTMENT_HEAD'), 'DEPARTMENT_HEAD')
  assert.deepEqual(items.map(({ path }) => path), [
    '/department/dashboard',
    '/department/students',
    '/department/qr-scan',
    '/department/community-service'
  ])
  assert.deepEqual(items.map(mobileNavLabel), ['Dashboard', 'Assigned Students', 'QR Scan', 'Service'])
})

test('Daily time record light header overrides legacy hero colors', async () => {
  const portalCss = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(portalCss, /:root:not\(\[data-theme='dark'\]\) \.dtr-intro\.portal-page-header :is\(h2, strong\)/)
  assert.match(portalCss, /:root:not\(\[data-theme='dark'\]\) \.dtr-intro\.portal-page-header :is\(\.eyebrow, p\)/)
  assert.match(portalCss, /:root:not\(\[data-theme='dark'\]\) \.dtr-intro\.portal-page-header > span/)
})

test('responsive portal includes a dedicated mobile bottom navigation', () => {
  assert.match(appSource, /className="mobile-bottom-nav"/)
  assert.match(cssSource, /@media \(max-width: 767px\)[\s\S]*\.mobile-bottom-nav/)
  assert.match(cssSource, /grid-template-columns: repeat\(5,1fr\)/)
})

test('sidebar and mobile logos use one dashboard action with navigation cleanup', () => {
  assert.match(appSource, /const goToDashboard = async \(\) => \{\s*if \(isQrScanning\) await stopQrScanner\(\)\s*setIsMobileNavOpen\(false\)\s*navigateTo\(getHomePath\(userRole\)\)\s*\}/)
  assert.equal((appSource.match(/onClick=\{goToDashboard\} aria-label="Go to dashboard"/g) || []).length, 2)
  assert.match(appSource, /className="brand-home"[^>]*>[\s\S]*className="brand-logo"[\s\S]*className="brand-favicon"[^>]*\/>\s*<\/button>\s*<button\s*className="sidebar-close"/)
  for (const [role, path] of Object.entries({ DISCIPLINE_ADMIN: '/admin/dashboard', DISCIPLINE_OFFICE: '/admin/dashboard', DEPARTMENT_HEAD: '/department/dashboard', STUDENT: '/student/dashboard' })) {
    assert.equal(getHomePath(role), path)
  }
})
