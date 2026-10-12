import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveRoute } from '../src/lib/routes.js'
import { sidebarNavigationFor, iconNameForView, sidebarTooltipFor } from '../src/lib/portalNavigation.js'

test('handbook is directly below Dashboard for both discipline roles only', () => {
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
    assert.equal(resolveRoute('/admin/handbook', role).status, 'allowed')
    assert.equal(sidebarNavigationFor(role)[1].path, '/admin/handbook')
  }
  for (const role of ['STUDENT', 'DEPARTMENT_HEAD']) {
    assert.equal(resolveRoute('/admin/handbook', role).status, 'unauthorized')
    assert.equal(sidebarNavigationFor(role).some(entry => entry.path === '/admin/handbook'), false)
  }
  assert.equal(iconNameForView('STI Handbook'), 'book')
  assert.equal(sidebarTooltipFor('STI Handbook'), 'Read the STI Student Handbook')
})

test('handbook reader defaults to the complete copy and offers all four PDFs', async () => {
  const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  try {
    const { default: HandbookPage, HANDBOOK_DOCUMENTS } = await server.ssrLoadModule('/src/components/HandbookPage.jsx')
    const html = renderToStaticMarkup(createElement(HandbookPage))
    assert.equal(HANDBOOK_DOCUMENTS.length, 4)
    assert.match(html, /<label[^>]*for="handbook-document"/)
    assert.match(html, /selected=""[^>]*>Complete Tertiary Handbook/)
    assert.match(html, /title="Complete Tertiary Handbook PDF"/)
    assert.match(html, /Open in new tab/)
    assert.match(html, /Download PDF/)
    assert.match(html, /Open STI’s live handbook/)
    for (const doc of HANDBOOK_DOCUMENTS) {
      const bytes = await readFile(new URL(`../public${doc.url}`, import.meta.url))
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
    }
  } finally { await server.close() }
})

test('admin header shortcut precedes the theme toggle and opens the handbook route', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const HandbookPage = lazy/)
  assert.match(app, /isAdmin && activeView === 'STI Handbook'/)
  const actions = app.slice(app.indexOf('<div className="account-actions">'))
  assert.match(actions, /isAdmin && <button[^\n]*aria-label="Open STI Handbook"[^\n]*navigateTo\('\/admin\/handbook'\)/)
  assert.ok(actions.indexOf('Open STI Handbook') < actions.indexOf('className="theme-toggle"'))
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
