import test from 'node:test'
import assert from 'node:assert/strict'
import { buildParentContactPayload, contactLabel } from '../src/lib/parentContact.js'

test('parent contact payload contains only append-only outcome fields', () => {
  assert.deepEqual(buildParentContactPayload({ guardianId: '7', method: 'CALL', outcome: 'REACHED', notes: ' Confirmed ', studentId: 99, actorId: 3 }), { guardian_id: 7, contact_method: 'CALL', outcome: 'REACHED', notes: 'Confirmed' })
})

test('parent contact labels are readable', () => {
  assert.equal(contactLabel('LEFT_MESSAGE'), 'Left message')
})

