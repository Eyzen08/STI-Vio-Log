// Run with the bundled Playwright package available through NODE_PATH.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const output = fileURLToPath(new URL('../artifacts/student-qr/', import.meta.url))
const payload = 'sti-attendance:6bd28978-721e-4798-b675-c42719268075'
const profile = { first_name: 'Test', last_name: 'Student', student_number: '02000123456', qr_code: payload }
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root" class="app-shell student-portal" style="display:block;padding:16px"></div><script type="module">
  import React from 'react'
  import { createRoot } from 'react-dom/client'
  import StudentQr from '/src/components/StudentQr.jsx'
  import '/src/index.css'
  import '/src/App.css'
  import '/src/styles/portal-system.css'
  import '/src/styles/portal-overrides.css'
  import '/src/styles/student-portal.css'
  const root = createRoot(document.getElementById('root'))
  window.renderQr = props => root.render(React.createElement(StudentQr, props))
  window.renderQr({profile:${JSON.stringify(profile)}})
  window.decodeStudentQr = async data => {
    const { Html5Qrcode } = await import('html5-qrcode')
    const element = document.createElement('div')
    element.id = 'qr-file-decoder'
    element.style.width = '720px'
    document.body.append(element)
    const scanner = new Html5Qrcode(element.id)
    try {
      return await scanner.scanFile(new File([new Uint8Array(data)], 'download.png', { type: 'image/png' }), false)
    } finally {
      scanner.clear()
      element.remove()
    }
  }
</script></body></html>`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{ name: 'student-qr-fixture', configureServer(vite) {
    vite.middlewares.use(async (request, response, next) => {
      if (request.url !== '/__student-qr.html') return next()
      response.setHeader('Content-Type', 'text/html')
      response.end(await vite.transformIndexHtml(request.url, html))
    })
  } }]
})
let browser
const errors = []

try {
  await mkdir(output, { recursive: true })
  await server.listen()
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, bypassCSP: true })
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(value => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = value })
      }, theme)
      await page.goto(server.resolvedUrls.local[0] + '__student-qr.html')
      const image = page.getByRole('img', { name: 'Your STI Vio-Log community-service attendance QR code' })
      await image.waitFor()
      const src = await image.getAttribute('src')
      const link = page.getByRole('link', { name: 'Download QR Code' })
      assert.equal(await link.getAttribute('href'), src, 'display and download must use one PNG')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'QR page must fit the viewport')
      const bounds = await image.boundingBox()
      assert.ok(Math.abs(bounds.width / bounds.height - 816 / 1024) < 0.001, 'branded PNG must retain its proportions')
      await page.screenshot({ path: output + `${theme}-${width}.png`, fullPage: true })

      const downloadPromise = page.waitForEvent('download')
      await link.click()
      const download = await downloadPromise
      assert.equal(download.suggestedFilename(), 'sti-vio-log-02000123456-qr.png')
      const filename = output + `${theme}-${width}-download.png`
      await download.saveAs(filename)
      const bytes = await readFile(filename)
      assert.deepEqual(bytes, Buffer.from(src.split(',')[1], 'base64'), 'download must preserve the exact displayed image')
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [816, 1024])
      const decoded = await page.evaluate(data => window.decodeStudentQr(data), [...bytes])
      assert.equal(decoded, payload, 'downloaded branded PNG must decode to the original opaque attendance code')

      await page.evaluate(value => window.renderQr({ profile: { ...value, qr_code: 'x'.repeat(5000) } }), profile)
      await page.getByRole('alert').waitFor()
      assert.match(await page.getByRole('alert').innerText(), /could not be rendered/)
      assert.equal(await page.getByRole('link', { name: 'Download QR Code' }).count(), 0)
      await page.evaluate(value => window.renderQr({ profile: { ...value, qr_code: null } }), profile)
      await page.getByText('No QR code is assigned to this student account.').waitFor()
      await page.evaluate(value => window.renderQr({ profile: value, loading: true }), profile)
      await page.locator('.qr-page-heading-skeleton').waitFor()
      assert.equal(await page.getByRole('link', { name: 'Download QR Code' }).count(), 0)
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
  console.log('Student QR verified: identical display/download PNG, real payload decode, desktop/mobile, light/dark, no overflow, unavailable/loading/render failure.')
} finally {
  await browser?.close()
  await server.close()
}
