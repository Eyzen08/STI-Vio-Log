import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const policy = await readFile(new URL('../src/components/PublicPolicyPage.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('application shell provides a keyboard skip link and focusable main landmark', () => {
  assert.match(app, /href="#main-content">Skip to main content/)
  assert.match(app, /<main className="main-panel" id="main-content" tabIndex="-1">/)
  assert.match(css, /\.skip-link:focus/)
})

test('public policy avoids nested main landmarks and discloses storage behavior', () => {
  assert.doesNotMatch(policy, /<main/)
  assert.match(policy, /Cookies, local storage, and analytics/)
  assert.match(policy, /does not currently use advertising cookies/)
})
