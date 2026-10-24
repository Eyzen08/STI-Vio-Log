import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('the foundation owns the shared layout and typography contract', () => {
  const foundation = read('index.css')
  for (const declaration of [
    '--text-page-title: 1.75rem', '--text-section-title: 1.25rem',
    '--page-gap: 1rem', '--card-radius: 0.75rem', '--card-padding: 1.25rem',
    '--summary-icon-size: 2.75rem', '--page-gutter: 1.25rem',
  ]) assert.ok(foundation.includes(declaration), declaration)
  assert.match(foundation, /@media \(max-width: 767px\)[\s\S]*--text-page-title: 1\.5rem/)
  assert.match(foundation, /@media \(max-width: 767px\)[\s\S]*--summary-icon-size: 2\.25rem/)
  assert.doesNotMatch(read('styles/portal-system.css').split('.app-shell {')[0], /--(?:color-primary|color-page|shadow-sm):/)
  assert.doesNotMatch(read('App.css'), /--portal-(?:muted|canvas|blue):/)
  assert.doesNotMatch(read('App.css'), /html,\s*body\s*\{[^}]*overflow-x:\s*hidden;/)
})

test('the shared presentation layer owns page headers and monitoring inherits its title', () => {
  const shared = read('styles/portal-system.css')
  assert.match(shared, /\.portal-page-header\s*\{[^}]*padding: var\(--card-padding\)/s)
  assert.doesNotMatch(read('styles/portal-overrides.css'), /^\.portal-page-header\s*\{/m)
  assert.doesNotMatch(shared, /\.system-monitoring-hero\.portal-page-header h2\s*\{[^}]*font-size:var\(--text-xl\)/)
})

test('working-page styles no longer impose competing desktop width limits', () => {
  for (const path of ['App.css', 'styles/portal-system.css', 'styles/portal-overrides.css', 'styles/student-portal.css', 'styles/department-portal.css']) {
    assert.doesNotMatch(read(path), /max-width:\s*(?:1120|1500|1700)px/, path)
  }
})
