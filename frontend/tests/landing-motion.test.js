import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

test('public artwork initializes independently of device or stored motion preferences', async () => {
  for (const page of ['LandingPage', 'LoginPage']) {
    const source = await readFile(new URL(`../src/components/${page}.jsx`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /usePublicMotion|motionMode|PublicMotionToggle|toggleMotion|motionControl/)
    assert.match(source, /import\('\.\.\/lib\/(landing|login)Motion\.js'\)/)
  }
  await assert.rejects(access(new URL('../src/lib/usePublicMotion.js', import.meta.url)), { code: 'ENOENT' })
})

test('public artwork only pauses when hidden or outside the viewport', async () => {
  const login = await readFile(new URL('../src/lib/loginMotion.js', import.meta.url), 'utf8')
  assert.doesNotMatch(login, /document\.hasFocus|document\.activeElement|aria-busy|focusin|focusout/)
  for (const file of ['loginMotion', 'landingMotion']) {
    const source = await readFile(new URL(`../src/lib/${file}.js`, import.meta.url), 'utf8')
    assert.match(source, /document\.hidden/)
    assert.match(source, /IntersectionObserver/)
    assert.match(source, /visibilitychange/)
    assert.match(source, /observer\.disconnect\(\)/)
    assert.match(source, /media\.revert\(\)/)
  }
})
