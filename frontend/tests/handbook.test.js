import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { getNavItems, resolveRoute } from '../src/lib/routes.js'
import { sidebarNavigationFor, iconNameForView, sidebarTooltipFor, mobileNavItemsFor } from '../src/lib/portalNavigation.js'

test('handbook is directly below Dashboard for discipline roles and students with role-protected routes', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
    assert.equal(resolveRoute('/admin/handbook', role).status, 'allowed')
    assert.equal(sidebarNavigationFor(role)[1].path, '/admin/handbook')
  }
  for (const role of ['STUDENT', 'DEPARTMENT_HEAD']) {
    assert.equal(resolveRoute('/admin/handbook', role).status, 'unauthorized')
    assert.equal(sidebarNavigationFor(role).some(entry => entry.path === '/admin/handbook'), false)
  }
  assert.equal(resolveRoute('/student/handbook', 'STUDENT').status, 'allowed')
  assert.equal(sidebarNavigationFor('STUDENT')[1].path, '/student/handbook')
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', null]) {
    assert.equal(resolveRoute('/student/handbook', role).status, 'unauthorized')
  }
  const studentNav = getNavItems('STUDENT')
  const mobilePaths = mobileNavItemsFor(studentNav, 'STUDENT').map(item => item.path)
  assert.equal(studentNav.filter(item => !mobilePaths.includes(item.path)).some(item => item.path === '/student/handbook'), true)
  assert.equal(iconNameForView('STI Handbook'), 'book')
  assert.equal(sidebarTooltipFor('STI Handbook'), 'Read the STI Student Handbook')
})

test('handbook offers four PDFs through explicit view and download links without an embedded reader', async () => {
  const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  try {
    const { default: HandbookPage, HANDBOOK_DOCUMENTS } = await server.ssrLoadModule('/src/components/HandbookPage.jsx')
    const html = renderToStaticMarkup(createElement(HandbookPage))
    assert.equal(HANDBOOK_DOCUMENTS.length, 4)
    assert.match(html, /<label[^>]*for="handbook-document"/)
    assert.match(html, /selected=""[^>]*>Complete Tertiary Handbook/)
    assert.doesNotMatch(html, /<(?:iframe|object|embed)\b/)
    assert.match(html, /href="\/handbook\/sti-tertiary-handbook-july-2026.pdf" target="_blank" rel="noopener noreferrer">View PDF \(new tab\)/)
    assert.match(html, /href="\/handbook\/sti-tertiary-handbook-july-2026.pdf" download="">Download PDF/)
    assert.match(html, /Open STI’s Live Handbook/)
    assert.match(html, /Saved copy captured/)
    for (const doc of HANDBOOK_DOCUMENTS) {
      const bytes = await readFile(new URL(`../public${doc.url}`, import.meta.url))
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
    }
  } finally { await server.close() }
})

test('admin header shortcut precedes the theme toggle and opens the handbook route', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const HandbookPage = lazy/)
  const handbookRender = app.indexOf("if (activeView === 'STI Handbook') return <HandbookPage />")
  assert.ok(handbookRender > app.indexOf("if (routeResolution.status === 'unauthorized')"))
  assert.ok(handbookRender < app.indexOf('if (isStudent) {', app.indexOf('const renderContent')))
  const actions = app.slice(app.indexOf('<div className="account-actions">'))
  assert.match(actions, /isAdmin && <button[^\n]*aria-label="Open STI Handbook"[^\n]*navigateTo\('\/admin\/handbook'\)/)
  assert.ok(actions.indexOf('Open STI Handbook') < actions.indexOf('className="theme-toggle"'))
})

test('student management offers a native handbook link beside Add Student', async () => {
  const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  try {
    const { default: StudentManagement } = await server.ssrLoadModule('/src/components/StudentManagement.jsx')
    const html = renderToStaticMarkup(createElement(StudentManagement))
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
    assert.match(header, /<a[^>]*href="\/admin\/handbook"[^>]*>.*Student Handbook<\/a>/)
    assert.match(header, /Add Student/)
  } finally { await server.close() }
})

test('saved handbook collection matches its verified capture manifest', async () => {
  const assets = new URL('../public/handbook/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('source-manifest.json', assets), 'utf8'))
  assert.equal(manifest.requiredReadingSections, 51)
  assert.equal(manifest.sections.length, 53)
  assert.equal(new Set(manifest.sections.map(section => section.id)).size, 53)
  assert.equal(Object.keys(manifest.files).length, 4)
  for (const [name, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name, assets))).digest('hex'), hash, name)
  }
})
