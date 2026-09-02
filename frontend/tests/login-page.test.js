import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/LoginPage.jsx', import.meta.url), 'utf8')

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
