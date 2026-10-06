import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/components/AdminDashboard.jsx', import.meta.url), 'utf8')

test('active view is derived from the resolved URL without duplicated route state', () => {
  assert.match(app, /const activeView = routeResolution\.status === 'allowed' \? routeResolution\.route\.view : ''/)
  assert.doesNotMatch(app, /\[activeView, setActiveView\]/)
})

test('session restoration gates routing and protected rendering', () => {
  assert.match(app, /const \[sessionRestoring, setSessionRestoring\] = useState\(Boolean\(initialSession\.user\)\)/)
  assert.match(app, /if \(sessionRestoring\) return[\s\S]*?if \(!isLoggedIn\)/)
  assert.ok(app.indexOf('if (sessionRestoring) {') < app.indexOf("if (!isLoggedIn && routeResolution.status === 'not_found')"))
})

test('student account settings render before the student dashboard fallback', () => {
  const renderContent = app.slice(app.indexOf('const renderContent'))
  const settings = renderContent.indexOf("if (activeView === 'Account Settings')")
  const studentFallback = renderContent.indexOf('if (isStudent)')
  assert.ok(settings > -1 && settings < studentFallback)
  assert.match(renderContent.slice(settings, studentFallback), /AccountSecuritySettings/)
})

test('resolved dashboard total uses authoritative completed or cleared violations', () => {
  assert.match(dashboard, /\['COMPLETE', 'CLEAR'\]\.includes\(status\)/)
  assert.match(dashboard, /violations\.filter\(\(item\) => resolved\(item\.status\)\)\.length/)
  assert.doesNotMatch(dashboard, /const casesResolved = assignments/)
})

test('notification badges use the API summary instead of the loaded page length', () => {
  assert.match(app, /setUnreadNotificationCount\(Number\(notificationsData\.summary\?\.unread \|\| 0\)\)/)
  assert.match(app, /item\.view === 'Notifications'\) return \{ count: unreadNotificationCount/)
  assert.doesNotMatch(app, /item\.view === 'Notifications'\)[^\n]*studentNotifications\.filter/)
})
