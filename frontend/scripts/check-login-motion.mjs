import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const artifacts = new URL('../artifacts/interactive-login/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const server = process.env.LOGIN_CHECK_URL ? null : await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('') } })
if (server) await server.listen()
const origin = process.env.LOGIN_CHECK_URL || server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const errors = []
const transforms = page => page.locator('.login-campus-drift, .login-campus-parallax, .login-ribbon').evaluateAll(elements => elements.map(el => getComputedStyle(el).transform))
const readable = async page => {
  const content = await page.locator('.login-brand-mark, .login-intro-content, .login-card').evaluateAll(elements => elements.map(el => ({ opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility })))
  assert.equal(content.length, 3)
  assert.ok(content.every(el => el.opacity === '1' && el.visibility === 'visible'), JSON.stringify(content))
  assert.equal(await page.locator('.login-card').evaluate(el => getComputedStyle(el).transform), 'none')
}
const contextFor = async ({ theme = 'dark', motion = 'full', reducedMotion = 'no-preference', touch = false, failure = false, delay = false, stall = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion, hasTouch: touch, isMobile: touch })
  await context.addInitScript(({ theme, motion, stall }) => {
    if (!localStorage.getItem('sti-vio-log-theme')) localStorage.setItem('sti-vio-log-theme', theme)
    if (!localStorage.getItem('sti-vio-log-landing-motion')) localStorage.setItem('sti-vio-log-landing-motion', motion)
    if (stall) {
      const raf = requestAnimationFrame.bind(window)
      window.requestAnimationFrame = callback => raf(time => { if (!document.querySelector('.login-campus-drift')?.style.transform) callback(time) })
    }
  }, { theme, motion, stall })
  let releaseLogin
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/login') {
      await new Promise(resolve => { releaseLogin = resolve })
      await route.fulfill({ status: 400, json: { message: 'Fixture sign-in feedback' } })
    } else await route.fulfill({ status: path === '/api/auth/session' ? 401 : 200, json: { success: true, csrf_token: 'fixture-csrf' } })
  })
  if (failure) await context.route(/\/loginMotion[^/]*\.js/, route => route.abort())
  if (delay) await context.route(/\/loginMotion[^/]*\.js/, async route => { await pause(1200); await route.continue() })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(new URL('/login', origin).href)
  await page.getByRole('heading', { name: /^Welcome Back$/i }).waitFor()
  assert.equal(await page.locator('.login-page').getAttribute('data-motion'), reducedMotion === 'reduce' ? 'reduced' : 'full')
  if (reducedMotion !== 'reduce' && !failure) await page.waitForFunction(() => document.querySelector('.login-campus-drift')?.style.transform, undefined, { polling: 100 })
  await pause(2200)
  await readable(page)
  return { page, context, release: () => releaseLogin() }
}
try {
  for (const theme of ['light', 'dark']) {
    const fixture = await contextFor({ theme })
    const { page, context } = fixture
    assert.equal(await page.locator('.login-utility-controls button').count(), 1)
    const controls = await page.locator('.login-utility-controls button').evaluateAll(elements => elements.map(el => ({ text: el.textContent, width: el.offsetWidth, height: el.offsetHeight })))
    assert.ok(controls.every(el => !el.text.trim() && el.width === 44 && el.height === 44))
    assert.equal(await page.getByRole('button', { name: /Switch to .* Mode/ }).count(), 1)
    await page.screenshot({ path: fileURLToPath(new URL(`${theme}-full-1366.png`, artifacts)), fullPage: true })
    await page.mouse.move(20, 20)
    const before = await transforms(page)
    await pause(900)
    assert.notDeepEqual(await transforms(page), before, 'Motion must run automatically when the device allows it')
    const input = page.locator('#username')
    const bounds = await input.boundingBox()
    const intro = await page.locator('.login-intro').boundingBox()
    await page.mouse.move(intro.x + intro.width * .8, intro.y + intro.height * .3)
    await pause(500)
    assert.deepEqual(await input.boundingBox(), bounds, 'Artwork must never move the form')
    assert.match(await page.locator('.login-intro').evaluate(el => getComputedStyle(el).cursor), /landing-cursor-yellow/)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('.login-page').getAttribute('data-cursor'), null)
    await input.fill('02000123456')
    await page.locator('#password').fill('Fixture!Password123')
    await pause(350)
    const focused = await transforms(page)
    await pause(700)
    assert.deepEqual(await transforms(page), focused, 'Focus pauses all decoration')
    await input.hover()
    assert.equal(await input.evaluate(el => getComputedStyle(el).cursor), 'text')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.getByRole('button', { name: 'Signing In…', exact: true }).waitFor()
    await page.evaluate(() => document.activeElement.blur())
    const busy = await transforms(page)
    await pause(600)
    assert.deepEqual(await transforms(page), busy, 'Busy forms pause decoration even after losing focus')
    fixture.release()
    await page.getByText('Fixture sign-in feedback', { exact: true }).waitFor()
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
    const hidden = await transforms(page)
    await pause(500)
    assert.deepEqual(await transforms(page), hidden, 'Hidden documents pause decoration')
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.login-page')?.dataset.motion === 'reduced')
    assert.equal(await page.locator('.login-page').getAttribute('data-motion'), 'reduced')
    assert.equal(await page.locator('.login-utility-controls .auth-theme-toggle svg').evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    assert.ok((await transforms(page)).every(value => value === 'none'))
    await page.getByRole('link', { name: 'Back to Home', exact: true }).click()
    await page.getByRole('heading', { name: 'Know your next step.', exact: true }).waitFor()
    assert.equal(await page.locator('.landing-page').getAttribute('data-motion'), 'reduced')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForFunction(() => document.querySelector('.landing-page')?.dataset.motion === 'full')
    await page.getByRole('link', { name: 'Sign In', exact: true }).last().click()
    await page.getByRole('heading', { name: /^Welcome Back$/i }).waitFor()
    assert.equal(await page.locator('.login-page').getAttribute('data-motion'), 'full')
    assert.equal(await page.locator('.public-motion-toggle').count(), 0)
    assert.equal(await page.locator('.login-page').getAttribute('data-motion'), 'full')
    await pause(2200)
    await readable(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.login-page')?.dataset.motion === 'reduced')
    await page.reload()
    await page.locator('.login-page[data-motion="reduced"]').waitFor()
    for (const width of [360, 390, 768, 1366, 1920, 683]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`)
      const field = await page.locator('#username').boundingBox()
      assert.ok(field.x >= 0 && field.x + field.width <= width + 1)
      await page.screenshot({ path: fileURLToPath(new URL(`${theme}-${width}.png`, artifacts)), fullPage: true })
    }
    await page.reload()
    await page.locator('.login-page[data-motion="reduced"]').waitFor()
    assert.equal(await page.locator('.login-page').getAttribute('data-motion'), 'reduced')
    assert.equal(await page.evaluate(() => localStorage.getItem('sti-vio-log-theme')), theme)
    await context.close()
  }
  for (const options of [{ reducedMotion: 'reduce' }, { motion: 'reduced' }, { failure: true }, { delay: true }, { stall: true }, { touch: true }]) {
    const { page, context } = await contextFor(options)
    if (options.failure || options.touch || options.reducedMotion === 'reduce') assert.equal(await page.locator('.login-page').getAttribute('data-cursor'), null)
    if (options.touch) {
      await page.setViewportSize({ width: 390, height: 600 })
      assert.equal(await page.locator('.login-ribbon-frame').evaluate(el => getComputedStyle(el).display), 'none')
      await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
      await pause(400)
      assert.ok(await page.locator('.login-intro').evaluate(el => el.getBoundingClientRect().bottom <= 0), 'Mobile artwork left the viewport')
      const offscreen = await transforms(page)
      await pause(500)
      assert.deepEqual(await transforms(page), offscreen, 'Offscreen mobile artwork pauses')
    }
    await page.emulateMedia({ forcedColors: 'active' })
    await page.mouse.move(40, 40)
    assert.equal(await page.locator('.login-page').getAttribute('data-cursor'), null)
    await readable(page)
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log('PASS: shared motion, stable forms, focused/busy pauses, themed controls, native cursors, failure recovery, responsive layouts, and route cleanup.')
} finally { await browser.close(); await server?.close() }
