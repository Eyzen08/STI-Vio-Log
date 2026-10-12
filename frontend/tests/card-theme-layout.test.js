import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const styles = (name) => readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8')
const portal = styles('portal-system.css')
const overrides = styles('portal-overrides.css')
const students = styles('admin-students.css')
const geometry = /(?:^|;)\s*(?:padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|(?:min-|max-)?(?:width|height)|flex(?:-[\w-]+)?|grid(?:-[\w-]+)?|gap|display|align-items|justify-content|font(?:-[\w-]+)?|line-height|letter-spacing|text-align|white-space|border(?:-width|-style|-radius)?)\s*:/

function declarations(css, selector) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').some((part) => part.trim() === selector))
    .map((match) => match[2])
}

test('page and header spacing comes from shared responsive rules in both themes', () => {
  for (const [css, selector] of [
    [portal, "[data-theme='dark'] .page-content"],
    [overrides, ":root[data-theme='dark'] .portal-page-header"],
  ]) {
    const rules = declarations(css, selector)
    assert.ok(rules.length, `${selector} retains its theme colors`)
    for (const rule of rules) assert.doesNotMatch(rule, geometry, selector)
  }
  assert.match(portal, /@media[^{}]+\{[\s\S]*?\.page-content\s*\{\s*padding: 14px 12px 24px;/)
  assert.match(overrides, /@media \(max-width: 767px\)\s*\{\s*\.portal-page-header\s*\{[^}]*padding: 1\.1rem;/)
})

test('student summary icons use shared desktop and mobile sizes', () => {
  const rules = declarations(students, ":root[data-theme='dark'] .student-summary-card > i")
  assert.equal(rules.length, 1)
  assert.doesNotMatch(rules[0], geometry)
  assert.match(students, /\.student-summary-card > i\s*\{[^}]*flex:0 0 60px;[^}]*height:60px;/)
  assert.match(students, /@media \(max-width:767px\)[\s\S]*?\.student-summary-card > i\s*\{[^}]*flex-basis:40px; height:40px;/)
})

test('dark card details keep the light layout without adding borders or list padding', () => {
  for (const selector of [
    '.selected-account-summary',
    '.system-dashboard .account-action-tabs > button',
    '.app-modal .compact-stepper button',
    '.clearance-summary-card .clearance-state',
    '.clearance-requirements ul',
    '.record-fields .record-field-label small',
    '.recent-activity-card li i',
  ]) {
    const rules = declarations(overrides, `:root[data-theme='dark'] ${selector}`)
    assert.ok(rules.length, `${selector} retains its theme colors`)
    for (const rule of rules) assert.doesNotMatch(rule, geometry, selector)
  }
})
