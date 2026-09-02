import test from 'node:test'
import assert from 'node:assert/strict'

import { departmentTypeLabel, resolveDepartmentId } from '../src/lib/departmentAccounts.js'

test('typed department types resolve only to an existing active option', () => {
  const departments = [
    { id: 7, department_code: 'Library Department', department_name: 'Cardo Dalisay' },
    { id: 9, department_code: 'School Guard Department', department_name: 'Princess Marie' }
  ]

  assert.equal(resolveDepartmentId(departments, ' library   department '), 7)
  assert.equal(resolveDepartmentId(departments, 'SCHOOL GUARD DEPARTMENT'), 9)
  assert.equal(resolveDepartmentId(departments, 'Unknown Department'), null)
  assert.equal(resolveDepartmentId(departments, ''), null)
  assert.equal(departmentTypeLabel(departments[0]), 'Library Department')
})
