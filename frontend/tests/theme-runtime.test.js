import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { applyTheme, normalizeTheme, readDocumentTheme, THEME_STORAGE_KEY } from '../src/lib/theme.js'

const bootstrap = await readFile(new URL('../public/theme-bootstrap.js', import.meta.url), 'utf8')

function createThemeEnvironment(initialTheme) {
  const attributes = new Map()
  const meta = { setAttribute: (name, value) => attributes.set(name, value) }
  const documentRef = {
    documentElement: { dataset: initialTheme ? { theme: initialTheme } : {}, style: {} },
    querySelector: (selector) => selector === 'meta[name="theme-color"]' ? meta : null,
  }
  const stored = new Map()
  const storageRef = { setItem: (key, value) => stored.set(key, value) }
  return { attributes, documentRef, stored, storageRef }
}

function runBootstrap(storedTheme, storageBlocked = false) {
  const environment = createThemeEnvironment()
  const context = {
    document: environment.documentRef,
    localStorage: {
      getItem: () => {
        if (storageBlocked) throw new Error('blocked')
        return storedTheme
      },
    },
  }
  runInNewContext(bootstrap, context)
  return environment
}

test('bootstrap applies saved dark theme before application startup', () => {
  const environment = runBootstrap('dark')
  assert.equal(environment.documentRef.documentElement.dataset.theme, 'dark')
  assert.equal(environment.documentRef.documentElement.style.colorScheme, 'dark')
  assert.equal(environment.attributes.get('content'), '#071421')
})

test('bootstrap uses complete light fallback for missing, invalid, or blocked storage', () => {
  for (const environment of [runBootstrap(null), runBootstrap('system'), runBootstrap(null, true)]) {
    assert.equal(environment.documentRef.documentElement.dataset.theme, 'light')
    assert.equal(environment.documentRef.documentElement.style.colorScheme, 'light')
    assert.equal(environment.attributes.get('content'), '#075aab')
  }
})

test('theme values normalize to the supported light and dark contract', () => {
  assert.equal(normalizeTheme('dark'), 'dark')
  assert.equal(normalizeTheme('light'), 'light')
  assert.equal(normalizeTheme('system'), 'light')
  assert.equal(normalizeTheme(undefined), 'light')
})

test('document theme supplies the bootstrap result to React', () => {
  assert.equal(readDocumentTheme(createThemeEnvironment('dark').documentRef), 'dark')
  assert.equal(readDocumentTheme(createThemeEnvironment('invalid').documentRef), 'light')
})

test('applying theme updates root, browser chrome, and persistence synchronously', () => {
  const environment = createThemeEnvironment('light')
  assert.equal(applyTheme('dark', environment.documentRef, environment.storageRef), 'dark')
  assert.equal(environment.documentRef.documentElement.dataset.theme, 'dark')
  assert.equal(environment.documentRef.documentElement.style.colorScheme, 'dark')
  assert.equal(environment.attributes.get('content'), '#071421')
  assert.equal(environment.stored.get(THEME_STORAGE_KEY), 'dark')
})

test('blocked storage does not prevent root theme application', () => {
  const environment = createThemeEnvironment('dark')
  const blockedStorage = { setItem: () => { throw new Error('blocked') } }
  assert.doesNotThrow(() => applyTheme('light', environment.documentRef, blockedStorage))
  assert.equal(environment.documentRef.documentElement.dataset.theme, 'light')
  assert.equal(environment.documentRef.documentElement.style.colorScheme, 'light')
  assert.equal(environment.attributes.get('content'), '#075aab')
})
