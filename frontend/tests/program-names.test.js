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

test('new program and strand names match the provided offerings', () => {
  const expected = {
    BSCPE: 'Bachelor of Science in Computer Engineering',
    BSAIS: 'Bachelor of Science in Accounting Information Systems',
    BACOMM: 'Bachelor of Arts in Communication',
    'STEM-ETM': 'Science, Technology, Engineering, and Mathematics – Engineering, Technology, and Mathematics',
    'B&E': 'Business and Entrepreneurship',
    'DCA-DSAI-II': 'Data Collection and Annotation – Data Science-Artificial Intelligence (Level II)',
    'AIPA-III': 'AI Prompting and Automation (Level III)'
  }
  for (const [code, name] of Object.entries(expected)) assert.equal(formatProgramName(code.toLowerCase()), name)
})
