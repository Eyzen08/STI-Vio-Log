import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const icon = await readFile(new URL('../src/components/PortalIcon.jsx', import.meta.url), 'utf8')
const foundation = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const portal = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')

test('appearance preference defaults to the light reference, persists, and updates browser color scheme', () => {
  assert.match(app, /localStorage\.getItem\('sti-vio-log-theme'\)/)
  assert.match(app, /if \(savedTheme === 'light' \|\| savedTheme === 'dark'\) return savedTheme\s+return 'light'/)
  assert.match(app, /document\.documentElement\.dataset\.theme = theme/)
  assert.match(app, /document\.documentElement\.style\.colorScheme = theme/)
  assert.match(app, /localStorage\.setItem\('sti-vio-log-theme', theme\)/)
})

test('theme controls remain named and available in both public and portal shells', () => {
  assert.equal((app.match(/aria-label=\{`Switch to \$\{theme === 'dark' \? 'light' : 'dark'\} mode`\}/g) || []).length, 2)
  assert.match(app, /aria-pressed=\{theme === 'dark'\}/)
  assert.match(app, /className="theme-toggle auth-theme-toggle"/)
  assert.match(icon, /sun:/)
  assert.match(icon, /moon:/)
})

test('dark mode is token driven and covers core portal, form, table, modal, and mobile surfaces', () => {
  assert.match(foundation, /:root\[data-theme='dark'\]/)
  for (const selector of ['.topbar', 'input,select,textarea', 'table,thead,tbody,tr,th,td', '.modal-content', '.mobile-bottom-nav', '.auth-shell']) {
    assert.match(portal, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(portal, /@media \(prefers-reduced-motion: reduce\)/)
})
