import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let server, DashboardAnalytics, downloadAnalytics
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  const module = await server.ssrLoadModule('/src/components/DashboardAnalytics.jsx')
  DashboardAnalytics = module.default
  downloadAnalytics = module.downloadAnalytics
})
after(async () => { await server?.close() })

test('analytics offers both formats and blocks export while data is loading or unavailable', () => {
  const render = (props = {}) => renderToStaticMarkup(createElement(DashboardAnalytics, { students: [], violations: [], assignments: [], ...props }))
  assert.match(render(), /Excel \(\.xlsx\)/)
  assert.match(render(), /CSV \(\.csv\)/)
  assert.match(render(), /dashboard-analytics-heading[\s\S]*?<\/div><\/div><div class="dashboard-analytics-filters"/)
  assert.match(render(), /<button[^>]*data-action-disabled="false"[^>]*>Export<\/button>/)
  for (const props of [{ loading: true }, { error: 'Unavailable' }]) {
    assert.match(render(props), /<button[^>]*disabled=""[^>]*>Export<\/button>/)
  }
})

test('analytics download submits the snapshot and releases its blob URL', async () => {
  assert.equal(typeof downloadAnalytics, 'function')
  const originalFetch = globalThis.fetch, originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  let submitted, clicked = false, revoked = ''
  const anchor = { click() { clicked = true } }
  const snapshot = { range: { from: '2026-10-01', to: '2026-10-07' }, program: 'BSIT', analytics: { violationCount: 2 } }
  globalThis.document = { createElement: () => anchor }
  URL.createObjectURL = () => 'blob:analytics'
  URL.revokeObjectURL = value => { revoked = value }
  globalThis.fetch = async (url, options) => {
    submitted = { url, options }
    return new Response('spreadsheet', { status: 200 })
  }
  try {
    for (const format of ['xlsx', 'csv']) {
      await downloadAnalytics(snapshot, format)
      assert.match(submitted.url, new RegExp(`/api/reports/analytics\\.${format}$`))
      assert.equal(submitted.options.method, 'POST')
      assert.deepEqual(JSON.parse(submitted.options.body), snapshot)
      assert.equal(anchor.download, `STI_Vio-Log_Analytics_2026-10-01_2026-10-07.${format}`)
      assert.equal(clicked, true)
      assert.equal(revoked, 'blob:analytics')
    }
    clicked = false
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Permission denied' } }), { status: 403 })
    await assert.rejects(downloadAnalytics(snapshot, 'xlsx'), /Permission denied/)
    assert.equal(clicked, false)
    globalThis.fetch = async () => { throw new Error('Network unavailable') }
    await assert.rejects(downloadAnalytics(snapshot, 'csv'), /Network unavailable/)
  } finally {
    globalThis.fetch = originalFetch; globalThis.document = originalDocument
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke
  }
})
