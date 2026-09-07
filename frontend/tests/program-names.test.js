import test from 'node:test'
import assert from 'node:assert/strict'
import { formatProgramName } from '../src/lib/programNames.js'

test('program abbreviations use readable certificate names', () => {
  assert.equal(formatProgramName('BSCS'), 'Bachelor of Science in Computer Science')
  assert.equal(formatProgramName(' bsit '), 'Bachelor of Science in Information Technology')
})

test('unknown and missing program values remain safe', () => {
  assert.equal(formatProgramName('Custom Program'), 'Custom Program')
  assert.equal(formatProgramName(''), 'Program not recorded')
})
