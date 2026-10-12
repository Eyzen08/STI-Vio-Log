import test from 'node:test'
import assert from 'node:assert/strict'
import { LANDING_MOTION_KEY, normalizeLandingMotion } from '../src/lib/landingPreferences.js'

test('landing motion defaults to Full and accepts only an explicit Reduced choice', () => {
  assert.equal(LANDING_MOTION_KEY, 'sti-vio-log-landing-motion')
  for (const value of [null, undefined, '', 'full', 'invalid', 'paused', {}, 0]) {
    assert.equal(normalizeLandingMotion(value), 'full')
  }
  assert.equal(normalizeLandingMotion('reduced'), 'reduced')
})
