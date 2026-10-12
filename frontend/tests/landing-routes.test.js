import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_ROUTES, accountSetupRedirect, resolveRoute } from '../src/lib/routes.js'
import { metadataForRoute } from '../src/lib/pageMetadata.js'
import { installMutationRequestGuard } from '../src/lib/api.js'

test('the welcome page stays public for guests and every portal role', () => {
  assert.ok(PUBLIC_ROUTES.includes('/'))
  for (const role of [null, 'STUDENT', 'DEPARTMENT_HEAD', 'DISCIPLINE_OFFICE', 'DISCIPLINE_ADMIN']) {
    assert.equal(resolveRoute('/', role).status, 'public')
  }
})

test('browsing home never bypasses or forces account setup', () => {
  for (const user of [null, { role: 'STUDENT', password_change_required: true }, { role: 'STUDENT', onboarding_required: true }]) {
    assert.equal(accountSetupRedirect('/', user), null)
  }
  assert.equal(accountSetupRedirect('/login', { role: 'STUDENT', password_change_required: true }), '/account/password-change')
  assert.equal(accountSetupRedirect('/login', { role: 'STUDENT', onboarding_required: true }), '/student/onboarding')
  assert.equal(resolveRoute('/student/violations', null).status, 'unauthorized')
})

test('welcome metadata describes browsing the student portal', () => {
  assert.match(metadataForRoute('/').description, /View your records, track community service/)
  assert.equal(metadataForRoute('/').robots, 'index, follow')
})

test('an expired session clears credentials without redirecting away from the welcome page', async () => {
  const originalStorage = globalThis.localStorage
  const removed = []
  let redirect = null
  let expired = false
  globalThis.localStorage = { removeItem: key => removed.push(key) }
  const target = {
    fetch: async () => new Response('{}', { status: 401 }),
    location: { origin: 'https://portal.example.test', pathname: '/', replace: path => { redirect = path } },
    CustomEvent: class { constructor(type) { this.type = type } },
    dispatchEvent: event => { expired = event.type === 'sti:session-expired' },
  }
  try {
    installMutationRequestGuard(target)
    await target.fetch('/api/auth/session')
    assert.equal(redirect, null)
    assert.equal(expired, true)
    assert.ok(removed.includes('sti_vio_log_user'))
  } finally { globalThis.localStorage = originalStorage }
})
