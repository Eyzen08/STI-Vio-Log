// Uses the bundled Playwright package through NODE_PATH; all account requests are fixtures.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { auditThemeColors } from './lib/themeAudit.mjs'

const { chromium, expect } = createRequire(import.meta.url)('playwright/test')
const artifacts = fileURLToPath(new URL('../artifacts/portal-settings/', import.meta.url))
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="app-shell admin-portal" style="display:block"><main class="main-panel" style="margin:0;width:100%"><div id="root" class="page-content"></div></main></div><script type="module">
import React from 'react'
import { createRoot } from 'react-dom/client'
import AdminAccountSettings from '/src/components/AdminAccountSettings.jsx'
import AccountSecuritySettings from '/src/components/AccountSecuritySettings.jsx'
import '/src/index.css'
import '/src/App.css'
import '/src/styles/portal-system.css'
import '/src/styles/portal-overrides.css'
import '/src/styles/legal-policy.css'
import '/src/styles/department-portal.css'
const query = new URLSearchParams(location.search)
document.documentElement.dataset.theme = query.get('theme') || 'light'
const role = query.get('role') || 'DISCIPLINE_ADMIN'
document.querySelector('.app-shell').className='app-shell '+(role==='DEPARTMENT_HEAD'?'department-portal':role==='STUDENT'?'student-portal':'admin-portal')
const root = createRoot(document.getElementById('root'))
window.renderSettings = searchParams => root.render(React.createElement(role === 'DISCIPLINE_ADMIN' ? AdminAccountSettings : AccountSecuritySettings, {user:{id:1,username:'qa.account',role,first_name:'Juan',last_name:'Dela Cruz'}, searchParams, onSession:()=>{}}))
window.renderSettings(query.has('security') ? '?section=security' : '')
</script></body></html>`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: `${artifacts}vite-cache`,
  define: { 'import.meta.env.PROD': 'true' },
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{ name: 'portal-settings-fixture', configureServer(vite) {
    vite.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/__settings.html')) return next()
      response.setHeader('Content-Type', 'text/html')
      response.end(await vite.transformIndexHtml(request.url, html))
    })
  } }],
})
let browser
const errors = []
try {
  await mkdir(artifacts, { recursive: true })
  await server.listen()
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    page.on('pageerror', error => errors.push(error.message))
    const mutations = []
    page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText))
    await page.route('**/api/**', async route => {
      const request = route.request()
      if (request.method() !== 'GET') mutations.push(request.url())
      const path = new URL(request.url()).pathname
      const json = path === '/api/account/avatar' ? { avatar: { source: 'INITIALS', preset_id: null } }
        : path === '/api/account/admin-profile' ? { profile: { first_name: 'Juan', last_name: 'Dela Cruz', username: 'qa.account', email: 'qa@example.com', email_verified: false } }
          : { csrf_token: 'fixture' }
      await route.fulfill({ json })
    })
    await page.goto(`${server.resolvedUrls.local[0]}__settings.html?role=${role}&theme=${theme}`)
    const disclosures = page.locator('details[name="account-settings"]')
    await expect(disclosures).toHaveCount(role === 'DISCIPLINE_ADMIN' ? 3 : role === 'STUDENT' ? 1 : 2)
    await expect(page.locator('details[open]')).toHaveCount(0)
    const settingsWidth = await page.locator('.admin-settings-page,.account-settings-page').evaluate(el=>el.getBoundingClientRect().width)
    for (const disclosure of await disclosures.all()) {
      assert.ok(Math.abs((await disclosure.boundingBox()).width-settingsWidth)<2,`${role} ${theme} ${width}: settings rows fill available width`)
    }
    if (role === 'DISCIPLINE_ADMIN') await page.screenshot({ path: `${artifacts}collapsed-${theme}-${width}.png`, fullPage: true })
    await expect(page.locator('.avatar-choice').first()).not.toBeVisible()
    const avatar = disclosures.filter({ has: page.locator('summary strong', { hasText: 'Change Avatar' }) })
    await avatar.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(avatar).toHaveAttribute('open', '')
    await page.locator('.avatar-choice input[value="INITIALS"]').waitFor({ state: 'attached' })
    const preset = page.locator('.avatar-choice input').nth(1)
    await page.locator('.avatar-choice').nth(1).click()
    if (role === 'DISCIPLINE_ADMIN') {
      const profile = disclosures.filter({ has: page.locator('summary strong', { hasText: 'Administrator Profile' }) })
      await profile.locator('summary').click()
      await expect(avatar).not.toHaveAttribute('open', '')
      await page.getByLabel('First Name', { exact: true }).fill('Draft name')
      await avatar.locator('summary').click()
      await expect(preset).toBeChecked()
      await profile.locator('summary').click()
      await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Draft name')
      await expect(page.getByRole('heading', { name: 'Verify Recovery Email', exact: true })).toBeVisible()
    }
    if (role !== 'STUDENT') {
      await page.evaluate(() => window.renderSettings('?section=security'))
      await expect(page.locator('#account-security details')).toHaveAttribute('open', '')
      await expect(page.locator('#account-security')).toBeFocused()
      await expect(page.locator('details[open]')).toHaveCount(1)
      const password = page.getByLabel('Current Password', { exact: true })
      await password.fill('unsaved password')
      await avatar.locator('summary').click()
      await expect(preset).toBeChecked()
      await page.locator('#account-security summary').click()
      await expect(password).toHaveValue('unsaved password')
      await password.evaluate(element => element.setAttribute('aria-invalid', 'true'))
      await expect.poll(() => password.evaluate(element => {
        const color = document.createElement('span')
        color.style.color='var(--status-danger-text)'
        element.parentElement.append(color)
        const expected = getComputedStyle(color).color
        color.remove()
        return getComputedStyle(element).borderTopColor === expected
      }), { message:'Invalid fields retain their danger border over the neutral field boundary' }).toBe(true)
      await password.evaluate(element => element.setAttribute('aria-invalid', 'false'))
    } else {
      await expect(page.getByText(/To reset your password, sign out/)).toBeVisible()
      await expect(page.locator('input[type="password"]')).toHaveCount(0)
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${role} ${theme} ${width}: horizontal overflow`)
    assert.ok(await page.evaluate(() => document.querySelector('.settings-footer').getBoundingClientRect().top >= document.querySelector('.settings-list').getBoundingClientRect().bottom))
    await expect(page.getByRole('link', { name: 'Privacy Notice', exact: true })).toHaveAttribute('href', /^\/privacy\?return=/)
    const legalGap = await page.locator('.settings-footer a').evaluateAll(links => links[1].getBoundingClientRect().left - links[0].getBoundingClientRect().right)
    assert.ok(legalGap >= 16, 'Privacy Notice and Terms of Use need a visible gap')
    assert.deepEqual(mutations, [], 'Opening sections and editing drafts must not submit account changes')
    const colors = await page.evaluate(auditThemeColors)
    assert.deepEqual(colors.findings, [], `${role} ${theme} ${width}: settings colors`)
    await page.screenshot({ path: `${artifacts}${role}-${theme}-${width}.png`, fullPage: true })
    console.log(`PASS: ${role} ${theme} ${width}`)
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log('PASS: collapsed/exclusive sections, keyboard disclosure, avatar/profile/password drafts, security focus, verification UI, student recovery, policies and mobile/desktop light/dark layouts across four roles.')
} catch (error) {
  for (const page of browser?.contexts().flatMap(context => context.pages()) || []) {
    console.error(await page.locator('#root').innerText())
    await page.screenshot({ path: `${artifacts}failure.png`, fullPage: true }).catch(() => {})
  }
  throw error
} finally {
  await browser?.close()
  await server.close()
}
