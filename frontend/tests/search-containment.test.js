import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPortalSearchInput, prepareSearchInput } from '../src/lib/searchControls.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const read = (file) => fs.readFileSync(path.join(testDirectory, '..', file), 'utf8')

const input = ({ type = 'text', id = '', ariaLabel = '', placeholder = '', name = '' } = {}) => {
  const attributes = new Map([['aria-label', ariaLabel], ['placeholder', placeholder]])
  return {
    tagName: 'INPUT', type, id, name,
    getAttribute: (key) => attributes.get(key) || '',
    setAttribute: (key, value) => attributes.set(key, value),
    attributes
  }
}

test('portal search inputs disable browser history and receive stable names', () => {
  const field = input({ ariaLabel: 'Search staff accounts' })
  assert.equal(isPortalSearchInput(field), true)
  assert.equal(prepareSearchInput(field), true)
  assert.equal(field.attributes.get('autocomplete'), 'off')
  assert.equal(field.name, 'portal-search-staff-accounts')
})

test('ordinary data-entry inputs are not modified', () => {
  const field = input({ placeholder: 'First name' })
  assert.equal(prepareSearchInput(field), false)
  assert.equal(field.name, '')
})

test('department tabs share one surface and use an underline for selection', () => {
  const css = read('src/styles/portal-system.css')
  assert.match(css, /department-officer-tabs button\[aria-selected="true"\][\s\S]*background: var\(--portal-yellow\)/)
  assert.match(css, /department-officer-tabs button\[aria-selected="true"\]::after/)
  assert.doesNotMatch(css, /inset 0 0 0 2px #075cad/)
})

test('search and preview containers include explicit shrink and overflow rules', () => {
  const css = read('src/styles/portal-system.css')
  assert.match(css, /conversation-preview[\s\S]*text-overflow: ellipsis/)
  assert.match(css, /directory-toolbar[\s\S]*min-width: 0/)
  assert.match(css, /registration-review-heading[\s\S]*overflow-wrap: anywhere/)
})
