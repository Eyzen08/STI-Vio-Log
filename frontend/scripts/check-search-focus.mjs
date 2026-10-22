// Run with Playwright available locally or through NODE_PATH; no app dependency.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../artifacts/search-focus/', import.meta.url))
const user = { id: 99, role: 'DISCIPLINE_ADMIN', full_name: 'Search Test Staff' }
const server = await createServer({ root, cacheDir: `${output}vite-cache`, server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ bypassCSP: true })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return url.origin === new URL(origin).origin ? route.continue() : route.abort()
    const body = url.pathname === '/api/auth/session' ? { user, csrf_token: 'search-fixture' }
      : url.pathname === '/api/auth/legal' ? { legal: { required: false } }
        : { students: [], violations: [], assignments: [], sessions: [], notifications: [], summary: {}, conversations: [], recipients: [], messages: [], departments: [], profile: user, pagination: { page: 1, totalPages: 1, total: 0 } }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.addInitScript(user => localStorage.setItem('sti_vio_log_user', JSON.stringify(user)), user)
  const state = input => input.evaluate(element => {
    const inner = getComputedStyle(element), outer = getComputedStyle(element.parentElement)
    return { innerOutline: inner.outlineStyle, innerBorder: inner.borderTopWidth, innerShadow: inner.boxShadow, innerBackground: inner.backgroundColor, outerOutline: outer.outlineStyle, outerWidth: outer.outlineWidth, outerColor: outer.outlineColor, outerRadius: outer.borderRadius, outerShadow: outer.boxShadow }
  })
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      for (const [path, selectors] of [
        ['/admin/violations', ['.violation-search', '.directory-search']],
        ['/admin/students', ['.student-directory-search', '.topbar-search']],
        ['/admin/messages', ['.conversation-search']],
      ]) {
        await page.goto(`${origin}${path.slice(1)}`)
        await page.locator('.app-shell.admin-portal').waitFor()
        await page.locator('.route-loading').waitFor({ state: 'hidden' })
        await page.locator('.page-content h2:visible').first().waitFor()
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        if (path === '/admin/violations') {
          // The generic directory wrapper currently has no live JSX caller.
          await page.evaluate(() => {
            const wrapper = document.createElement('label')
            wrapper.className = 'directory-search'
            wrapper.style.cssText = 'display:flex;align-items:center;min-height:44px;border:1px solid var(--border-subtle);padding:0 16px'
            wrapper.innerHTML = '<input type="search" aria-label="Directory search fixture" placeholder="Search directories">'
            document.querySelector('.page-content').append(wrapper)
            const standalone = document.createElement('input')
            standalone.setAttribute('aria-label', 'Standalone field fixture')
            standalone.id = 'standalone-focus-fixture'
            document.querySelector('.page-content').append(standalone)
          })
          for (const selector of ['#standalone-focus-fixture', '.violation-toolbar select', '.violation-record-button']) {
            const control = page.locator(selector).first()
            await control.focus()
            await control.press('Tab')
            await page.keyboard.press('Shift+Tab')
            assert.equal(await control.evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid' && getComputedStyle(element).outlineWidth === '2px'), true, `${selector}: ordinary controls retain keyboard focus`)
          }
        }
        for (const selector of selectors) {
          const input = page.locator(`${selector} input`)
          if (!await input.isVisible()) { assert.equal(selector, '.topbar-search', 'only the responsive header search may be hidden'); continue }
          await page.locator('.page-content h2:visible').first().click()
          const before = await input.locator('..').boundingBox()
          for (const keyboard of [false, true]) {
            if (keyboard) { await input.press('Tab'); await page.keyboard.press('Shift+Tab') }
            else await input.click()
            assert.deepEqual(await state(input), {
              innerOutline: 'none', innerBorder: '0px', innerShadow: 'none', innerBackground: 'rgba(0, 0, 0, 0)',
              outerOutline: 'solid', outerWidth: '2px', outerColor: theme === 'dark' ? 'rgb(121, 194, 255)' : 'rgb(7, 95, 184)', outerRadius: '6px', outerShadow: 'none'
            }, `${selector} ${theme} ${width}: one outer focus outline (${keyboard ? 'keyboard' : 'mouse'})`)
          }
          const focused = await input.locator('..').boundingBox()
          assert.equal(focused.width, before.width, 'focus does not resize the field')
          assert.equal(focused.height, before.height, 'focus does not resize the field')
          if (selector === '.violation-search') await page.screenshot({ path: `${output}${theme}-${width}.png` })
          await input.pressSequentially('Juan')
          assert.equal(await input.inputValue(), 'Juan', 'search accepts typing')
          await input.fill('')
          assert.equal(await input.inputValue(), '', 'search can be cleared')
          await page.locator('.page-content h2:visible').first().click()
          assert.equal((await state(input)).outerOutline, 'none', `${selector}: focus outline clears on blur`)
        }
      }
      console.log(`PASS searches: mouse/keyboard focus, typing, clearing, blur, standalone controls; ${theme} ${width}px`)
    }
  }
  assert.deepEqual(errors, [], 'browser runtime errors')
} finally {
  await browser?.close()
  await server.close()
}
