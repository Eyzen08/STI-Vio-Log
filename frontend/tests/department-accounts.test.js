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

test('department labels support legacy readable codes and current official names', () => {
  assert.equal(departmentTypeLabel({ department_code: 'School Guard Department', department_name: 'Cardo Dalisay' }), 'School Guard Department')
  assert.equal(departmentTypeLabel({ department_code: 'SCHOOL_GUARD_DEPARTMENT', department_name: 'School Guard Department' }), 'School Guard Department')
  assert.equal(departmentTypeLabel({ department_code: 'STUDENT_AFFAIRS_AB12CD', department_name: 'Student Affairs' }), 'Student Affairs')
  assert.equal(departmentTypeLabel({ department_code: 'LIB', department_name: 'Main Library' }), 'Main Library')
  assert.equal(departmentTypeLabel({ department_code: '  School Guard Department  ', department_name: 'Cardo Dalisay' }), 'School Guard Department')
  assert.equal(departmentTypeLabel({ department_code: ' ', department_name: 'Library' }), 'Library')
  assert.equal(departmentTypeLabel({ department_code: 'LIB' }), 'LIB')
  assert.equal(departmentTypeLabel({}), 'Unnamed department')
})
