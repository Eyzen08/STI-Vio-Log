import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { iconNameForView, mobileNavItemsFor, mobileNavLabel } from '../src/lib/portalNavigation.js'
import { getNavItems } from '../src/lib/routes.js'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

test('role navigation uses meaningful visual categories and icons', () => {
  assert.equal(iconNameForView('Dashboard'), 'dashboard')
  assert.equal(iconNameForView('My Violations'), 'violations')
  assert.equal(iconNameForView('QR Scan'), 'qr')
  assert.equal(iconNameForView('Community Service'), 'service')
  assert.equal(iconNameForView('Active Attendance'), 'clock')
  assert.match(appSource, /className="nav-group"/)
  assert.match(appSource, /className="nav-group-label"/)
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
