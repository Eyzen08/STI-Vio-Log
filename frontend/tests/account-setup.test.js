import test from 'node:test'
import assert from 'node:assert/strict'
import * as routes from '../src/lib/routes.js'
import { metadataForRoute } from '../src/lib/pageMetadata.js'

test('setup URLs resolve with private titles and stay out of portal navigation', () => {
  for (const [path, title] of [['/student/onboarding', 'Student Account Setup'], ['/account/password-change', 'Create New Password']]) {
    const result = routes.resolveRoute(path, 'STUDENT')
    assert.equal(result.status, 'allowed')
    assert.equal(metadataForRoute(path, result.route.label).title, `${title} | STI Vio-Log`)
    assert.equal(metadataForRoute(path, result.route.label).robots, 'noindex, nofollow')
    assert.equal(routes.getNavItems('STUDENT').some(route => route.path === path), false)
    assert.equal(routes.resolveRoute(path, null).status, 'unauthorized')
  }
  assert.equal(routes.resolveRoute('/student/onboarding', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']) {
    assert.equal(routes.resolveRoute('/account/password-change', role).status, 'allowed')
  }
})

test('session redirects resume setup, preserve policy access, and leave completed setup', () => {
  const redirect = routes.accountSetupRedirect
  assert.equal(typeof redirect, 'function')
  const student = { role: 'STUDENT', password_change_required: true, onboarding_required: true }
  assert.equal(redirect('/student/dashboard', student), '/account/password-change')
  assert.equal(redirect('/account/password-change', student), null)
  assert.equal(redirect('/privacy', student), null)
  assert.equal(redirect('/terms', student), null)
  student.password_change_required = false
  assert.equal(redirect('/student/dashboard', student), '/student/onboarding')
  assert.equal(redirect('/student/onboarding', student), null)
  student.onboarding_required = false
  assert.equal(redirect('/student/onboarding', student), '/student/dashboard')
  assert.equal(redirect('/account/password-change', student), '/student/dashboard')
  assert.equal(redirect('/student/onboarding', student, true), null)
  assert.equal(redirect('/student/dashboard', student, true), null)
  assert.equal(redirect('/student/onboarding', null), '/login')
})
