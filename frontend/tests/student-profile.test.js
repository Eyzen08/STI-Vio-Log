import test from 'node:test'
import assert from 'node:assert/strict'

import { displayProfileValue, formatStudentName, formatYearLevel } from '../src/lib/studentProfile.js'

test('student names omit blank optional parts', () => {
  assert.equal(formatStudentName({
    first_name: ' Ana ', middle_name: '', last_name: 'Reyes', suffix: null
  }), 'Ana Reyes')
})

test('missing profile values use a consistent safe fallback', () => {
  assert.equal(displayProfileValue(null), 'Not provided')
  assert.equal(displayProfileValue('  '), 'Not provided')
  assert.equal(displayProfileValue('BSIT'), 'BSIT')
})

test('year levels receive readable ordinal labels', () => {
  assert.equal(formatYearLevel(1), '1st year')
  assert.equal(formatYearLevel(2), '2nd year')
  assert.equal(formatYearLevel(3), '3rd year')
  assert.equal(formatYearLevel(4), '4th year')
  assert.equal(formatYearLevel(null), 'Not provided')
})
