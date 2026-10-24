import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('public motion follows the device preference without manual or stored overrides', async () => {
  const hook = await readFile(new URL('../src/lib/usePublicMotion.js', import.meta.url), 'utf8')
  assert.match(hook, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(hook, /localStorage|landingPreferences/)
  for (const page of ['LandingPage', 'LoginPage']) {
    const source = await readFile(new URL(`../src/components/${page}.jsx`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /PublicMotionToggle|toggleMotion|motionControl/)
    assert.match(source, /data-motion=\{motionMode\}/)
  }
})
