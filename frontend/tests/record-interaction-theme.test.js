import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('shared row hover surfaces use theme tokens instead of pale fixed colors', () => {
  for (const path of ['App.css', 'styles/portal-system.css']) {
    const css = source(path)
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => /tbody tr(?::nth-child\([^)]*\))?:hover\s*$/.test(match[1].trim()))
    assert.ok(rules.length, path)
    for (const [, selector, declarations] of rules) {
      assert.doesNotMatch(declarations, /background(?:-color)?\s*:\s*(?:white|#[a-f\d]{3,8})\b/i, `${path}: ${selector.trim()}`)
      assert.match(declarations, /background\s*:\s*(?:var\(--surface-interactive-hover\)|color-mix\()/, path)
    }
  }
})

test('mobile dashboard actions share a two-column row with wrapping labels', () => {
  const css = source('styles/admin-dashboard.css')
  const mobile = css.slice(css.indexOf('@media (max-width:767px)'))
  assert.match(mobile, /\.dashboard-primary-actions\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[^}]*gap:8px;/)
  assert.match(mobile, /\.dashboard-primary-actions button\s*\{[^}]*min-width:0;[^}]*white-space:normal;/)
  assert.match(css, /\.dashboard-primary-actions[^}]*button[^}]*min-height:44px;/)
})
