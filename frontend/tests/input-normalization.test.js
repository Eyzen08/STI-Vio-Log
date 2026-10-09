import test from 'node:test'
import assert from 'node:assert/strict'
import { capitalizeWords, digitsOnly, normalizePersonName, normalizeNameSpacing, normalizeStudentSearch, emailWithoutSpaces, wholeNumberInput, isValidStudentName, isValidStudentSuffix, STUDENT_SUFFIXES } from '../src/lib/inputNormalization.js'

test('capitalizes first letters while preserving remaining input', () => {
  assert.equal(capitalizeWords('nicole dela cruz'), 'Nicole Dela Cruz')
  assert.equal(capitalizeWords('nICOLE  cruz'), 'NICOLE  Cruz')
})

test('student numbers keep only first 11 digits', () => {
  assert.equal(digitsOnly('02a00-123456789'), '02001234567')
  assert.equal(digitsOnly('00123456789'), '00123456789')
})

test('names filter typing and paste without losing legitimate punctuation', () => {
  assert.equal(normalizePersonName('34242$@'), '')
  assert.equal(normalizePersonName('josé3  dela$ cruz'), 'José  Dela Cruz')
  for (const name of ['Peña', 'O’Connor', "O'Brien", 'Jean-Luc', 'J. R. Reyes', '李 明']) assert.equal(isValidStudentName(name), true, name)
  for (const name of ['123', '---', '  ', 'Juan@', 'A'.repeat(151), {}]) assert.equal(isValidStudentName(name), false)
  assert.equal(normalizeNameSpacing('  Juan   Dela Cruz  '), 'Juan Dela Cruz')
  assert.equal(isValidStudentName('', {optional:true}), true)
})

test('suffix choices and lookup input preserve recorded result labels', () => {
  for (const suffix of ['', ...STUDENT_SUFFIXES]) assert.equal(isValidStudentSuffix(suffix), true)
  for (const suffix of ['$', 'Jr123', 'XI', {}]) assert.equal(isValidStudentSuffix(suffix), false)
  assert.equal(normalizeStudentSearch('@#$02000123456 Peña'), '02000123456 Peña')
  assert.equal(normalizeStudentSearch('Legacy@ - OLD-1', ['Legacy@ - OLD-1']), 'Legacy@ - OLD-1')
  assert.equal(normalizeStudentSearch('02000123456 - Juan Dela Cruz'), '02000123456 - Juan Dela Cruz')
})

test('whole number edits reject negative decimal and exponent input without reinterpreting it', () => {
  for (const invalid of ['-5', '1.5', '1e3', '+5', ' 5', '$48']) assert.equal(wholeNumberInput(invalid, '48'), '48')
  assert.equal(wholeNumberInput('', '48'), '')
  assert.equal(wholeNumberInput('75', ''), '75')
  assert.equal(emailWithoutSpaces(' juan .delacruz+test@ gmail.com '), 'juan.delacruz+test@gmail.com')
})
