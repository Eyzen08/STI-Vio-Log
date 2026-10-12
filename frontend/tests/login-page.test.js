import { readPortalStyles } from './helpers/portalStyles.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/LoginPage.jsx', import.meta.url), 'utf8')
const registrationSource = await readFile(
  new URL('../src/components/StudentPasswordAccess.jsx', import.meta.url),
  'utf8',
)
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const portalCssSource = readPortalStyles()
const loginCssSource = await readFile(new URL('../src/styles/login-page.css', import.meta.url), 'utf8')
const appCssSource = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

test('redesigned login keeps every existing authentication entry point', () => {
  assert.match(source, /onSubmit=\{onSubmit\}/)
  assert.match(source, /href="\/forgot-password"/)
  assert.doesNotMatch(source, /href="\/register"/)
  assert.match(source, /<GoogleStudentAccess clientId=\{googleClientId\} onSession=\{onGoogleSession\}/)
  assert.match(source, /<PasswordField/)
  assert.match(source, /href="\/privacy"/)
  assert.match(source, /href="\/terms"/)
})

test('login branding uses local imported building and logo assets', () => {
  assert.match(source, /import buildingImage from '\.\.\/assets\/sti-global-city-building-web\.jpg'/)
  assert.match(source, /import buildingNightImage from '\.\.\/assets\/sti-global-city-building-night\.jpg'/)
  assert.match(source, /import stiVioLogLogoTransparent from '\.\.\/assets\/sti-logo-web-transparent\.png'/)
  assert.match(source, /alt="STI Vio-Log"/)
  assert.match(source, /src=\{stiVioLogLogoTransparent\}/)
  assert.match(source, /alt="STI Global City campus building"/)
  assert.match(source, /width="1200" height="825" fetchPriority="high"/)
  assert.equal((source.match(/width="1200" height="825"/g) || []).length, 2)
  assert.match(source, /login-campus-image--night[^>]*src=\{buildingNightImage\}[^>]*aria-hidden="true"/)
  assert.match(appCssSource, /:root\[data-theme='dark'\] \.login-campus-image--day \{ opacity: 0; \}/)
  assert.match(appCssSource, /:root\[data-theme='dark'\] \.login-campus-image--night \{ opacity: 1; \}/)
})

test('login uses accessible form status and semantic navigation', () => {
  assert.match(source, /aria-busy=\{isSubmitting\}/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /getModifierState\('CapsLock'\)/)
  assert.match(source, /<nav className="auth-entry-actions"/)
  assert.match(source, /<nav className="auth-legal-links"/)
  assert.doesNotMatch(source, /auth-text-link/)
  assert.match(source, /STI Global City[\s\S]*Discipline Office/)
  assert.doesNotMatch(source, /<strong>Official<\/strong>/)
})

test('login portal information uses a semantic footer landmark', () => {
  assert.match(source, /<footer className="login-assurance">/)
  assert.doesNotMatch(source, /<div className="login-assurance" aria-label=/)
})

test('public Student registration has been retired', () => {
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
    assert.doesNotMatch(registrationSource, new RegExp(`${field}:`))
  }

  assert.doesNotMatch(registrationSource, /Student Identity/)
  assert.doesNotMatch(registrationSource, /Guardian Contact Information/)
  assert.doesNotMatch(registrationSource, /Account Security/)
  assert.doesNotMatch(registrationSource, /Creating Account…/)
})

test('portal branding uses the supplied local dashboard logo and favicon', () => {
  assert.match(appSource, /import stiVioLogLogo from '\.\/assets\/sti-logo-web\.png'/)
  assert.match(appSource, /alt="STI Vio-Log Discipline Office Portal"/)
  assert.match(htmlSource, /href="\/favicon-32\.png"/)
})

test('password visibility control is positioned inside the password field', () => {
  assert.match(portalCssSource, /\.auth-card \.password-input-wrap \{ position: relative; display: block; \}/)
  assert.match(portalCssSource, /\.auth-card \.password-visibility \{ position: absolute;/)
  assert.match(portalCssSource, /padding-right: 52px/)
  assert.match(portalCssSource, /right: 3px; bottom: 3px; left: auto; width: var\(--control-height\) !important/)
})

test('sign-in scopes floating labels to its two fields and preserves autocomplete', () => {
  assert.match(source, /className="login-form login-form--floating"/)
  assert.match(source, /className="login-floating-field" htmlFor="username"><span className="login-floating-label">Username or student number<\/span>/)
  assert.match(source, /labelClassName="login-floating-field" placeholder=" "/)
  assert.doesNotMatch(registrationSource, /login-floating-field/)
  assert.match(source, /autoComplete="username"/)
  assert.match(source, /autoComplete="current-password"/)
  assert.match(source, /aria-describedby=\{error\?'login-error':undefined\}/)
  assert.match(source, /<form[^>]*>[\s\S]*?<nav className="auth-entry-actions"[\s\S]*?<button type="submit" className="login-submit"[\s\S]*?<\/form>/)
})

test('Google is directly available and first-time guidance follows the sign-in actions', () => {
  assert.doesNotMatch(source, /google-access-details/)
  assert.match(source, /<GoogleStudentAccess[^>]*\/>[\s\S]*login-first-signin-note/)
})

test('login inputs cover focus, autofill, invalid, disabled and reduced-motion states', () => {
  for (const state of [':focus-visible', ':autofill', ':disabled', "[aria-invalid='true']", 'prefers-reduced-motion']) assert.ok(loginCssSource.includes(state), state)
  assert.match(loginCssSource, /font-size: 16px/)
})

test('authentication has one responsive style owner and preserves campus image layers', () => {
  assert.match(loginCssSource, /grid-template-columns: minmax\(0, 1\.04fr\) minmax\(0, \.96fr\)/)
  assert.match(loginCssSource, /width: min\(420px, 100%\)/)
  assert.match(loginCssSource, /height: calc\(100dvh - 48px\)/)
  assert.match(loginCssSource, /@media \(max-width: 1023px\)/)
  assert.match(loginCssSource, /height: 144px; min-height: 144px/)
  assert.match(appCssSource, /\.login-campus-image\s*\{[^}]*object-fit:\s*cover;/s)
  assert.doesNotMatch(portalCssSource, /login-form--outlined/)
})
