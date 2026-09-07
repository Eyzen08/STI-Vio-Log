import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { iconNameForView } from '../src/lib/portalNavigation.js'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

test('role navigation uses meaningful visual categories and icons', () => {
  assert.equal(iconNameForView('Dashboard'), 'dashboard')
  assert.equal(iconNameForView('My Violations'), 'violations')
  assert.equal(iconNameForView('QR Scan'), 'qr')
  assert.match(appSource, /className="nav-group"/)
  assert.match(appSource, /className="nav-group-label"/)
})

test('responsive portal includes a dedicated mobile bottom navigation', () => {
  assert.match(appSource, /className="mobile-bottom-nav"/)
  assert.match(cssSource, /@media \(max-width: 767px\)[\s\S]*\.mobile-bottom-nav/)
  assert.match(cssSource, /grid-template-columns: repeat\(5,1fr\)/)
})
