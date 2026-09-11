import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/LoginPage.jsx', import.meta.url), 'utf8')
const registrationSource = await readFile(
  new URL('../src/components/StudentPasswordAccess.jsx', import.meta.url),
  'utf8',
)
const registrationValidationSource = await readFile(
  new URL('../src/lib/studentRegistration.js', import.meta.url),
  'utf8',
)
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const portalCssSource = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')

test('redesigned login keeps every existing authentication entry point', () => {
  assert.match(source, /onSubmit=\{onSubmit\}/)
  assert.match(source, /href="\/forgot-password"/)
  assert.match(source, /href="\/register"/)
  assert.match(source, /<GoogleStudentAccess clientId=\{googleClientId\} onSession=\{onGoogleSession\}/)
  assert.match(source, /<PasswordField/)
  assert.match(source, /href="\/privacy"/)
  assert.match(source, /href="\/terms"/)
})

test('login branding uses local imported building and logo assets', () => {
  assert.match(source, /import buildingImage from '\.\.\/assets\/sti-global-city-building-web\.jpg'/)
  assert.match(source, /import stiVioLogLogo from '\.\.\/assets\/sti-vio-log-logo-web\.png'/)
  assert.match(source, /alt="STI Vio-Log"/)
  assert.match(source, /alt="STI Global City campus building"/)
  assert.match(source, /width="1200" height="825" fetchPriority="high"/)
})

test('login uses accessible form status and semantic navigation', () => {
  assert.match(source, /aria-busy=\{isSubmitting\}/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /<nav className="auth-entry-actions"/)
  assert.match(source, /<nav className="auth-legal-links"/)
  assert.doesNotMatch(source, /auth-text-link/)
})

test('manual Student registration collects the complete school profile', () => {
  for (const field of [
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'student_number',
    'email',
    'phone_number',
    'program',
    'section',
    'year_level',
    'guardian_name',
    'guardian_relationship',
    'guardian_phone_number',
  ]) {
    assert.match(registrationSource, new RegExp(`${field}:`))
  }

  assert.match(registrationSource, /Student Identity/)
  assert.match(registrationSource, /Guardian Contact Information/)
  assert.match(registrationSource, /Account Security/)
  assert.match(registrationValidationSource, /Review and Submit/)
  assert.match(registrationSource, /Creating Account…/)
})

test('portal branding uses the supplied local dashboard logo and favicon', () => {
  assert.match(appSource, /import stiVioLogLogo from '\.\/assets\/sti-vio-log-logo-web\.png'/)
  assert.match(appSource, /alt="STI Vio-Log Discipline Office Portal"/)
  assert.match(htmlSource, /href="\/favicon-32\.png"/)
})

test('password visibility control is positioned inside the password field', () => {
  assert.match(portalCssSource, /\.auth-card \.password-input-wrap \{ position: relative; display: block; \}/)
  assert.match(portalCssSource, /\.auth-card \.password-visibility \{ position: absolute;/)
  assert.match(portalCssSource, /padding-right: 52px/)
  assert.match(portalCssSource, /right: 3px; bottom: 3px; left: auto; width: 44px !important/)
})
