// Uses the bundled Playwright via NODE_PATH; all authentication responses are fixtures.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const artifacts = new URL('../artifacts/login-redesign/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0 },
  define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('login-check.apps.googleusercontent.com') },
})
await server.listen()
const origin = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = []
const requests = []
let enrollment = false
let googleUnavailable = false
let holdLogin = false
let releaseLogin
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, bypassCSP: true })
await context.addInitScript(() => {
  localStorage.setItem('sti-vio-log-theme', 'light')
  if (localStorage.getItem('login-sdk-unavailable')) return
  window.google = { accounts: { id: {
    initialize(config) { window.loginGoogleCallback = config.callback },
    renderButton(node, config) {
      const button = document.createElement('button')
      button.textContent = 'Continue with Google'
      button.style.cssText = `width:${Math.min(400, config.width)}px;height:44px;background:white;color:#3c4043;border:1px solid #dadce0;border-radius:4px;font:500 14px Arial;box-shadow:none`
      button.onclick = () => { config.click_listener(); setTimeout(() => window.loginGoogleCallback({ credential: 'fixture-google-credential' }), 50) }
      node.append(button)
    },
  } } }
})
await context.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.pathname.startsWith('/api/')) {
    const body = route.request().postDataJSON()
    requests.push({ path: url.pathname, body })
    let status = 200, data = { success: true, csrf_token: 'fixture-csrf' }
    if (url.pathname === '/api/auth/session') { status = 401; data = { message: 'Not signed in' } }
    else if (url.pathname === '/api/login') {
      if (holdLogin) await new Promise(resolve => { releaseLogin = resolve })
      data = enrollment ? { mfa_enrollment_required: true } : { mfa_required: true, server_time_ms: Date.now(), totp_period_seconds: 30 }
    }
    else if (url.pathname === '/api/auth/mfa/setup/start') data = { secret: 'FIXTURESETUPKEY123456', totp_period_seconds: 30 }
    else if (url.pathname === '/api/auth/mfa/setup/confirm') data = { recovery_codes: ['sample-code-one', 'sample-code-two'] }
    else if (['/api/auth/mfa/verify', '/api/auth/mfa/recovery'].includes(url.pathname)) { status = 400; data = { message: 'The code is invalid or expired.' } }
    else if (url.pathname === '/api/auth/google/login') { status = 403; data = { message: 'Use your linked Google account.' } }
    else if (url.pathname.endsWith('/password/forgot')) data = { message: 'If an account matches, a code has been sent.' }
    else if (url.pathname.endsWith('/password/verify')) data = { reset_token: 'fixture-reset-token' }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  } else if (url.origin === new URL(origin).origin) await route.continue()
  else if (url.hostname === 'accounts.google.com' && !googleUnavailable) await route.fulfill({ body: '' })
  else await route.abort()
})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(8000)
const visible = async locator => { await locator.waitFor({ state: 'visible' }) }
const screenshot = async name => {
  await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transitioning'))
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, artifacts)), fullPage: true })
}
const fits = async () => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
  for (const input of await page.locator('.login-page input').all()) {
    const bounds = await input.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width + 1, 'Input fits viewport')
  }
  const googleButton = page.locator('.google-button > button')
  if (await googleButton.count()) await page.waitForFunction(() => {
    const bounds = document.querySelector('.google-button > button').getBoundingClientRect()
    return bounds.x + bounds.width <= innerWidth
  }, null, { timeout: 2000 })
  assert.equal(await page.locator('.login-page h1').count(), 1, 'One page heading')
}
const contrast = (first, second) => {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}
const checkContrast = async () => {
  await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transitioning'))
  const colors = await page.evaluate(() => {
    const surface = node => {
      for (let parent = node; parent; parent = parent.parentElement) {
        const color = getComputedStyle(parent).backgroundColor
        if (color !== 'rgba(0, 0, 0, 0)') return color
      }
      return 'rgb(255, 255, 255)'
    }
    return [...document.querySelectorAll('.login-card h1,.login-card p,.login-card label,.login-card a,.login-submit,.auth-trust-note')].map(node => {
      const css = getComputedStyle(node)
      return { text: node.textContent.slice(0, 40), foreground: css.color, background: surface(node) }
    })
  })
  for (const color of colors) assert.ok(contrast(color.foreground, color.background) >= 4.5, `${color.text}: ${color.foreground} against ${color.background}`)
}
const signIn = async () => {
  await page.getByLabel(/^Username or student number$/i).fill('02000123456')
  await page.getByLabel(/^Password$/i).fill('Temporary!Pass123')
  await page.getByRole('button', { name: /^Sign in$/i, exact: true }).click()
}
const pasteCode = async (id, code = '123456') => {
  await page.locator(`#${id}-1`).evaluate((input, value) => {
    const data = new DataTransfer()
    data.setData('text/plain', value)
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, code)
}
const labelAt = async (id, raised) => {
  await page.waitForFunction(({ id, raised }) => {
    const input = document.getElementById(id), label = document.querySelector(`label[for="${id}"] .login-floating-label`)
    if (!label) return false
    const field = input.getBoundingClientRect(), bounds = label.getBoundingClientRect()
    return Math.abs(bounds.y + bounds.height / 2 - (raised ? field.y : field.y + field.height / 2)) < 1
  }, { id, raised })
}
const checkFloatingLabels = async () => {
  for (const id of ['username', 'password']) {
    const input = page.locator(`#${id}`)
    await input.fill('')
    await page.locator('#login-title').click()
    await labelAt(id, true)
    await input.focus()
    await labelAt(id, true)
    await input.fill(id === 'password' ? 'Temporary!Pass123' : '02000123456')
    await page.locator('#login-title').click()
    await labelAt(id, true)
    for (const state of ['invalid', 'disabled']) {
      await input.evaluate((node, state) => state === 'invalid' ? node.setAttribute('aria-invalid', 'true') : node.setAttribute('disabled', ''), state)
      await labelAt(id, true)
      await page.waitForFunction(id => {
        const nodes = [document.getElementById(id), document.querySelector(`label[for="${id}"] .login-floating-label`)]
        return nodes.every(node => node.getAnimations().every(animation => animation.playState !== 'running'))
      }, id)
      assert.equal(await input.evaluate(node => getComputedStyle(node).backgroundColor), await page.locator(`label[for="${id}"] .login-floating-label`).evaluate(node => getComputedStyle(node).backgroundColor), `${state} label notch matches its field`)
    }
    await input.evaluate(node => { node.removeAttribute('disabled'); node.setAttribute('aria-invalid', 'false') })
    await input.fill('')
    await page.locator('#login-title').click()
    await labelAt(id, true)
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` })
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['autofill'] })
    await labelAt(id, true)
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    await labelAt(id, true)
  }
  await page.getByRole('button', { name: /^Show password$/i }).click()
  await labelAt('password', true)
  await page.getByRole('button', { name: /^Hide password$/i }).click()
  const input = await page.locator('#password').boundingBox(), help = await page.getByRole('link', { name: /^Forgot password\?$/i }).boundingBox()
  assert.ok(help.y >= input.y + input.height, 'Account help sits below the password field')
  await page.locator('#login-title').click()
}

try {
  await page.goto(`${origin}login`)
  await visible(page.getByRole('heading', { name: /^Welcome back$/i, exact: true }))
  await visible(page.getByRole('button', { name: /^Continue with Google$/i }))
  assert.equal(await page.locator('.google-access-details').count(), 0, 'Google is directly available')
  await page.getByRole('button', { name: /^Continue with Google$/i }).click()
  await visible(page.getByText('Use your linked Google account.', { exact: true }))
  await screenshot('google-error-light')
  await page.reload()
  await visible(page.getByRole('button', { name: /^Continue with Google$/i }))
  await fits()
  await page.locator('#username').focus()
  assert.equal(await page.locator('#username').getAttribute('autocomplete'), 'username')
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('#password').evaluate(node => node === document.activeElement), true)
  assert.equal(await page.locator('#password').getAttribute('autocomplete'), 'current-password')
  assert.notEqual(await page.locator('#password').evaluate(node => getComputedStyle(node).outlineStyle), 'none')
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('button', { name: /^Show password$/i }).evaluate(node => node === document.activeElement), true)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: new RegExp(`Switch to ${theme} mode`, 'i') }).click()
    await page.waitForFunction(() => !document.documentElement.classList.contains('theme-transitioning'))
    for (const id of ['username', 'password']) {
      await labelAt(id, true)
    }
    await page.locator('#username').focus()
    await checkContrast()
    for (const width of [320, 390, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 })
      if (width === 320 || width === 1366) await checkFloatingLabels()
      await fits()
      await screenshot(`login-${theme}-${width}`)
    }
    await page.locator('#username').focus()
    await labelAt('username', true)
    await screenshot(`floating-label-focused-${theme}`)
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.getByLabel(/^Password$/i).fill('Temporary!Pass123')
  await page.getByRole('button', { name: /^Show password$/i }).click()
  assert.equal(await page.locator('#password').getAttribute('type'), 'text')
  await page.getByRole('button', { name: /^Hide password$/i }).click()
  await page.locator('#password').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', modifierCapsLock: true, bubbles: true })))
  await visible(page.getByText('Caps Lock is on', { exact: true }))
  await page.locator('#password').evaluate(input => input.dispatchEvent(new KeyboardEvent('keyup', { key: 'A', modifierCapsLock: false, bubbles: true })))
  holdLogin = true
  await signIn()
  await visible(page.getByRole('button', { name: /^Signing in…$/i, exact: true }))
  assert.equal(await page.locator('#username').isDisabled(), true)
  assert.equal(await page.locator('#password').isDisabled(), true)
  assert.equal(await page.locator('.login-form').getAttribute('aria-busy'), 'true')
  assert.equal(await page.getByRole('link', { name: /^Forgot password\?$/i }).getAttribute('aria-disabled'), 'true')
  holdLogin = false
  releaseLogin()
  await visible(page.getByRole('heading', { name: /^Two-factor authentication$/i, exact: true }))
  await fits()
  await pasteCode('mfa-code', '213345')
  await page.getByRole('button', { name: /^Use a recovery code$/i }).click()
  await visible(page.getByLabel(/^Recovery code$/i))
  assert.equal(await page.getByLabel(/^Recovery code$/i).inputValue(), '', 'Changing mode clears code atomically')
  await page.getByLabel(/^Recovery code$/i).fill('sample-recovery-code')
  await page.getByRole('button', { name: /^Verify$/i, exact: true }).click()
  await visible(page.getByRole('alert'))
  assert.deepEqual(requests.findLast(entry => entry.path === '/api/auth/mfa/recovery').body, { recovery_code: 'sample-recovery-code' })
  await screenshot('recovery-code-dark')
  await page.getByRole('button', { name: /^Use authenticator code$/i }).click()
  assert.equal(await page.locator('#mfa-code-1').inputValue(), '')
  await pasteCode('mfa-code')
  assert.equal(await page.locator('#mfa-code-6').inputValue(), '6')
  await page.getByRole('button', { name: /^Verify$/i, exact: true }).click()
  await visible(page.getByRole('alert'))
  assert.deepEqual(requests.findLast(entry => entry.path === '/api/auth/mfa/verify').body, { code: '123456' })
  await screenshot('mfa-dark')
  await page.setViewportSize({ width: 320, height: 568 })
  await fits()
  await screenshot('mfa-dark-320')
  await page.getByRole('button', { name: /^Cancel$/i, exact: true }).click()
  await page.getByRole('link', { name: /^Forgot password\?$/i }).click()
  await visible(page.getByRole('heading', { name: /^Forgot password\?$/i, exact: true }))
  await page.getByLabel(/^Student number or email/i).fill('02000123456')
  await page.getByRole('link', { name: /^Privacy Notice$/i }).click()
  await page.getByRole('button', { name: /return|back/i }).first().click()
  assert.equal(await page.getByLabel(/^Student number or email/i).inputValue(), '02000123456')
  await page.getByRole('button', { name: /^Send verification code$/i }).click()
  await visible(page.getByRole('heading', { name: /^Check your email$/i, exact: true }))
  await pasteCode('password-reset-code')
  await fits()
  await screenshot('reset-code-dark-320')
  await page.getByRole('button', { name: /^Verify code$/i, exact: true }).click()
  await visible(page.getByRole('heading', { name: /^Create a new password$/i, exact: true }))
  await page.getByLabel(/^New password$/i).fill('New!Password123')
  await page.getByLabel(/^Confirm new password$/i).fill('Different!Password123')
  await page.getByRole('button', { name: /^Reset password$/i, exact: true }).click()
  await visible(page.getByText('Password confirmation does not match.', { exact: true }))
  await fits()
  await screenshot('new-password-dark-320')
  await page.getByLabel(/^Confirm new password$/i).fill('New!Password123')
  await page.getByRole('button', { name: /^Reset password$/i, exact: true }).click()
  await visible(page.getByRole('heading', { name: /^Welcome back$/i, exact: true }))
  enrollment = true
  await signIn()
  await visible(page.getByRole('heading', { name: /^Set up your authenticator$/i, exact: true }))
  await pasteCode('mfa-code')
  await fits()
  await screenshot('enrollment-dark-320')
  await page.getByRole('button', { name: /^Enable MFA$/i, exact: true }).click()
  await visible(page.getByRole('heading', { name: /^Save your recovery codes$/i, exact: true }))
  await fits()
  await screenshot('saved-recovery-dark-320')
  await page.goto(`${origin}login`)
  await visible(page.getByRole('heading', { name: /^Welcome back$/i, exact: true }))
  await page.setViewportSize({ width: 1366, height: 540 })
  await fits()
  await screenshot('login-short-1366')
  await page.setViewportSize({ width: 683, height: 384 })
  await fits()
  await screenshot('login-200-percent-reflow')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.login-motion-toggle[aria-pressed="true"]').click()
  assert.equal(await page.locator('.login-submit').evaluate(node => getComputedStyle(node).transitionDuration), '0s')
  await page.locator('#username').focus()
  await labelAt('username', true)
  assert.equal(await page.locator('label[for="username"] .login-floating-label').evaluate(node => node.getAnimations().length), 0, 'Reduced motion updates the label immediately')
  googleUnavailable = true
  await page.evaluate(() => localStorage.setItem('login-sdk-unavailable', 'true'))
  await page.reload()
  await visible(page.getByText('Google sign-in could not be loaded. Try again later.', { exact: true }))
  assert.equal(await page.locator('#username').isEnabled(), true)
  await screenshot('google-unavailable')
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('PASS: responsive light/dark login, direct Google access, MFA mode switching and submission, OTP paste, recovery journey, policy drafts, enrollment and recovery codes.')
} catch (error) {
  await screenshot('failure')
  console.error(await page.locator('main').innerText(), requests, errors)
  throw error
} finally {
  await browser.close()
  await server.close()
}
