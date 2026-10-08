import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let server, AdminAuditLog, downloadAuditExcel
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false } })
  AdminAuditLog = (await server.ssrLoadModule('/src/components/AdminAuditLog.jsx')).default
  downloadAuditExcel = (await server.ssrLoadModule('/src/lib/auditLog.js')).downloadAuditExcel
})
after(async () => { await server?.close() })

test('audit export is disabled while activity loads and explains its scope', () => {
  const html = renderToStaticMarkup(createElement(AdminAuditLog, { token: 'test' }))
  assert.match(html, /<button[^>]*disabled=""[^>]*>[\s\S]*?Generate Excel/)
  assert.match(html, /all activities matching the applied filters/i)
})

test('audit download uses only applied filters, server filename, and releases the URL on success or click failure', async () => {
  assert.equal(typeof downloadAuditExcel, 'function')
  const originalFetch = globalThis.fetch, originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  let submitted, clicks = 0, revokes = 0
  const anchor = { click() { clicks++ } }
  globalThis.document = { createElement: () => anchor }
  URL.createObjectURL = () => 'blob:audit'
  URL.revokeObjectURL = value => { assert.equal(value, 'blob:audit'); revokes++ }
  globalThis.fetch = async (url, options) => {
    submitted = { url, options }
    return new Response('spreadsheet', { headers: { 'Content-Disposition': 'attachment; filename="STI_Vio-Log_Audit_Log_2026-10-08.xlsx"' } })
  }
  try {
    await downloadAuditExcel({ action: 'TIME_IN', user_id: '9', from_date: '2026-10-08', page: 2 }, 'session')
    assert.match(submitted.url, /\/api\/audit-logs\/export\.xlsx\?action=TIME_IN&user_id=9&from_date=2026-10-08$/)
    assert.equal(submitted.options.headers.Authorization, 'Bearer session')
    assert.equal(anchor.download, 'STI_Vio-Log_Audit_Log_2026-10-08.xlsx')
    assert.equal(clicks, 1); assert.equal(revokes, 1)
    anchor.click = () => { throw new Error('Download blocked') }
    await assert.rejects(downloadAuditExcel({}, 'session'), /Download blocked/)
    assert.match(submitted.url, /\/export\.xlsx$/)
    assert.equal(revokes, 2)
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Permission denied' }), { status: 403 })
    await assert.rejects(downloadAuditExcel({}, 'session'), /Permission denied/)
    globalThis.fetch = async () => { throw new Error('Network unavailable') }
    await assert.rejects(downloadAuditExcel({}, 'session'), /Network unavailable/)
    assert.equal(revokes, 2)
  } finally {
    globalThis.fetch = originalFetch; globalThis.document = originalDocument
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke
  }
})
