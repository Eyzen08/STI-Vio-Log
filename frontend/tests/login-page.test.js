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
const portalCssSource = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
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
  assert.match(source, /<span>Official STI Global City Discipline Office Portal<\/span>/)
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
  assert.match(portalCssSource, /right: 3px; bottom: 3px; left: auto; width: 44px !important/)
})

test('authentication background keeps a stable crop while forms change height', () => {
  assert.match(portalCssSource, /height: calc\(100dvh - clamp\(1\.5rem, 4\.2vw, 3rem\)\)/)
  assert.match(portalCssSource, /\.auth-shell \.login-page--student-flow \{ overflow: visible; \}/)
  assert.match(portalCssSource, /\.auth-shell \.login-page--student-flow \.login-intro \{\s+position: sticky;/)
  assert.match(portalCssSource, /height: 15\.5rem;\s+min-height: 15\.5rem;\s+flex: 0 0 15\.5rem/)
  assert.match(portalCssSource, /height: 14rem; min-height: 14rem; flex-basis: 14rem/)
})

test('login logo anchors to the desktop hero corner and returns to flow on mobile', () => {
  assert.match(portalCssSource, /@media \(min-width: 768px\)\s*\{\s*\.auth-shell \.login-brand-mark\s*\{[^}]*position:\s*absolute;[^}]*top:\s*1\.5rem;[^}]*left:\s*1\.5rem;/s)
  assert.match(portalCssSource, /@media \(max-width: 767px\)[\s\S]*?\.auth-shell \.login-brand-mark\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;[^}]*left:\s*auto;/s)
})

test('Safari mobile authentication uses a covered hero image and dynamic viewport units', () => {
  assert.match(appCssSource, /\.login-campus-image\s*\{[^}]*position:\s*absolute;[^}]*object-fit:\s*cover;/s)
  assert.match(appCssSource, /min-height:\s*100dvh/)
  assert.match(appCssSource, /env\(safe-area-inset-top\)/)
  assert.match(portalCssSource, /\.app-shell\.auth-shell\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*none;[^}]*padding:\s*0;/s)
  assert.match(portalCssSource, /\.app-shell\.auth-shell \.main-panel,[\s\S]*?\.app-shell\.auth-shell \.login-form-panel\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s)
})
