import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { publishedPolicies } from '../../shared/legalPolicies.mjs'
import { manilaDateKey } from '../src/lib/dashboardAnalytics.js'

const components = {}
before(async () => {
  for (const name of ['PublicPolicyPage', 'SystemDashboard', 'StudentProfile', 'DashboardAnalytics']) {
    const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: `src/components/${name}.jsx`, write: false } })
    const code = bundle.output[0].code.replace(/from "(react(?:-dom)?(?:\/[^" ]+)?)"/g, (_, id) => `from "${import.meta.resolve(id)}"`)
    components[name] = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
  }
})

test('policy contents and headings use title case without altering published policy text', () => {
  const before = JSON.stringify(publishedPolicies)
  const html = renderToStaticMarkup(createElement(components.PublicPolicyPage, { type: 'privacy', onNavigate() {} }))
  assert.match(html, /<h2>Information Handled by the Portal<\/h2>/)
  assert.match(html, />Information Handled by the Portal<\/a>/)
  assert.match(html, /Keep your credentials private, sign out on shared devices/)
  assert.equal(JSON.stringify(publishedPolicies), before)
})

test('security result filters preserve API enum values behind title-case option labels', () => {
  const originalWindow = globalThis.window
  globalThis.window = { location: { search: '' } }
  try {
    const html = renderToStaticMarkup(createElement(components.SystemDashboard, { user: {} }))
    assert.match(html, /<option value="SUCCESS">Success<\/option>/)
    assert.match(html, /<option value="FAILED">Failed<\/option>/)
    assert.match(html, /<option value="DENIED">Denied<\/option>/)
  } finally { globalThis.window = originalWindow }
})

test('profile headings preserve entered names, usernames, and department information', () => {
  const html = renderToStaticMarkup(createElement(components.StudentProfile, { profile: { first_name: 'maria', last_name: 'de la CRUZ', student_number: '02000123456', program: 'BSIT', section: 'itA-101' }, username: 'student.user' }))
  assert.match(html, /maria de la CRUZ/)
  assert.match(html, /student\.user/)
  assert.match(html, /itA-101/)
  assert.match(html, /<h3>Academic Information<\/h3>/)
})

test('analytics title-cases insights while preserving recorded program names', () => {
  const html = renderToStaticMarkup(createElement(components.DashboardAnalytics, {
    students: [{ id: 1, program: 'itA-101' }],
    violations: [{ student_id: 1, incident_date: manilaDateKey(new Date()), status: 'OPEN' }],
    assignments: [],
  }))
  assert.match(html, /<dt>itA-101<\/dt>/)
  assert.match(html, /<dt>Violation Change<\/dt>/)
})
