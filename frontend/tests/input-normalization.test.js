import test from 'node:test'
import assert from 'node:assert/strict'
import { capitalizeWords, digitsOnly } from '../src/lib/inputNormalization.js'

test('capitalizes first letters while preserving remaining input', () => {
  assert.equal(capitalizeWords('nicole dela cruz'), 'Nicole Dela Cruz')
  assert.equal(capitalizeWords('nICOLE  cruz'), 'NICOLE  Cruz')
})

test('student numbers keep only first 11 digits', () => {
  assert.equal(digitsOnly('02a00-123456789'), '02001234567')
  assert.equal(digitsOnly('00123456789'), '00123456789')
})
