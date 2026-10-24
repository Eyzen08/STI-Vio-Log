import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

let AccountSecuritySettings
before(async () => {
  const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/components/AccountSecuritySettings.jsx', write: false } })
  const code = bundle.output[0].code.replace(/from "(react(?:\/[^" ]+)?)"/g, (_, id) => `from "${import.meta.resolve(id)}"`)
  AccountSecuritySettings = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
})

const render = (role) => {
  const originalWindow = globalThis.window
  globalThis.window = { location: { pathname: '/student/account', search: '', hash: '' } }
  try { return renderToStaticMarkup(createElement(AccountSecuritySettings, { user: { id: 8, username: 'test-account', role }, searchParams: '?section=security' })) }
  finally { globalThis.window = originalWindow }
}

test('student settings direct password recovery to the login page and retain avatar and policies', () => {
  const html = render('STUDENT')
  assert.doesNotMatch(html, /type="password"|>Change Password<|account-password-form/)
  assert.match(html, /To reset your password, sign out and select Forgot Password on the login page\. A verification code will be sent to your registered Gmail\./)
  assert.match(html, /id="avatar-settings-title">Avatar</)
  assert.match(html, />Privacy Notice<\/a>/)
  assert.match(html, />Terms of Use<\/a>/)
})

test('staff settings retain current-password changes', () => {
  for (const role of ['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']) {
    const html = render(role)
    assert.match(html, /id="settings-current-password"/)
    assert.match(html, /id="settings-new-password"/)
    assert.match(html, /id="settings-confirm-password"/)
    assert.match(html, />Change Password<\/button>/)
    assert.match(html, /Changing your password signs out other sessions\./)
  }
})

test('settings use collapsed exclusive disclosures with policies after the last form', () => {
  for (const role of ['STUDENT', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']) {
    const html = render(role)
    assert.match(html, /<details[^>]*name="account-settings"/)
    assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/)
    assert.match(html, /<summary>[\s\S]*?Change Avatar/)
    assert.ok(html.indexOf('Privacy Notice') > html.lastIndexOf('</details>'))
    if (role !== 'STUDENT') assert.match(html, /id="account-security"[^>]*>[\s\S]*?<details/)
  }
})
