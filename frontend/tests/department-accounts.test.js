import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDepartmentId } from '../src/lib/departmentAccounts.js'

test('typed department names resolve only to an existing active option', () => {
  const departments = [
    { id: 7, department_name: 'Library Department' },
    { id: 9, department_name: 'School Guard Department' }
  ]

  assert.equal(resolveDepartmentId(departments, ' library   department '), 7)
  assert.equal(resolveDepartmentId(departments, 'SCHOOL GUARD DEPARTMENT'), 9)
  assert.equal(resolveDepartmentId(departments, 'Unknown Department'), null)
  assert.equal(resolveDepartmentId(departments, ''), null)
})
