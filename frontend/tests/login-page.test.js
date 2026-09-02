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

test('redesigned login keeps every existing authentication entry point', () => {
  assert.match(source, /onSubmit=\{onSubmit\}/)
  assert.match(source, /onNavigate\('\/forgot-password'\)/)
  assert.match(source, /onNavigate\('\/register'\)/)
  assert.match(source, /<GoogleStudentAccess clientId=\{googleClientId\} onSession=\{onGoogleSession\}/)
  assert.match(source, /<PasswordField/)
})

test('login branding uses local imported building and logo assets', () => {
  assert.match(source, /import buildingImage from '\.\.\/assets\/sti-global-city-building\.jpg'/)
  assert.match(source, /import stiLogo from '\.\.\/assets\/sti-logo\.png'/)
  assert.match(source, /alt="STI Global City"/)
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
  assert.match(registrationSource, /Parent\/Guardian Information/)
  assert.match(registrationSource, /Account Security/)
  assert.match(registrationValidationSource, /Review and Submit/)
  assert.match(registrationSource, /Creating Account…/)
})

test('portal branding uses the supplied local dashboard logo and favicon', () => {
  assert.match(appSource, /import stiVioLogLogo from '\.\/assets\/sti-vio-log-logo\.png'/)
  assert.match(appSource, /alt="STI Vio-Log Discipline Office Portal"/)
  assert.match(htmlSource, /href="\/sti-vio-log-favicon\.png"/)
})
