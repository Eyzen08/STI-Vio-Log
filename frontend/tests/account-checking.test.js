import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

let TermsAcknowledgment
before(async () => {
  const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: 'src/components/TermsAcknowledgment.jsx', write: false } })
  const code = bundle.output[0].code.replace(/from "(react(?:\/[^" ]+)?)"/g, (_, id) => `from "${import.meta.resolve(id)}"`)
  TermsAcknowledgment = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
})
const render = (props = {}) => {
  const originalWindow = globalThis.window
  globalThis.window = { location: { pathname: '/login', search: '', hash: '' } }
  try { return renderToStaticMarkup(createElement(TermsAcknowledgment, props)) }
  finally { globalThis.window = originalWindow }
}

test('account checks use a compact card with an accessible loading status and available links', () => {
  const html = render()
  assert.match(html, /legal-acknowledgment--compact/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status"[^>]*><span class="action-spinner" aria-hidden="true"/)
  assert.match(html, /Verifying Terms acknowledgment/)
  assert.match(html, />Privacy Notice<\/a>/)
  assert.match(html, />Terms of Use<\/a>/)
  assert.match(html, /<button type="button" class="text-button">Sign out<\/button>/)
})

test('failed account checks keep the compact card, stop loading, and offer retry', () => {
  const html = render({ error: 'Unable to verify account access' })
  assert.match(html, /legal-acknowledgment--compact/)
  assert.match(html, /aria-busy="false"/)
  assert.doesNotMatch(html, /action-spinner|role="status"/)
  assert.match(html, /role="alert">Unable to verify account access/)
  assert.match(html, />Try again<\/button>/)
})

test('verified accounts stop loading and required Terms keep their review layout', () => {
  const verified = render({ status: { required: false } })
  assert.doesNotMatch(verified, /action-spinner|role="status"/)
  const review = render({ status: { required: true, terms_version: '1', privacy_notice_version: '1' } })
  assert.doesNotMatch(review, /legal-acknowledgment--compact|action-spinner/)
  assert.match(review, /Review the Terms of Use/)
  assert.match(review, /Acknowledge Terms and continue/)
})
