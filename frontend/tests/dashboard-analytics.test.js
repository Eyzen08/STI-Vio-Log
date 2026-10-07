import test from 'node:test'
import assert from 'node:assert/strict'
import * as analyticsModule from '../src/lib/dashboardAnalytics.js'
const { analyticsForRange, periodRange, manilaDateKey } = analyticsModule

test('Manila ranges compare equivalent prior periods and reject invalid custom dates', () => {
  assert.deepEqual(periodRange('THIS_MONTH', '2026-10-06'), {
    from: '2026-10-01', to: '2026-10-06', previousFrom: '2026-09-01', previousTo: '2026-09-06'
  })
  assert.deepEqual(periodRange('LAST_MONTH', '2026-10-06'), {
    from: '2026-09-01', to: '2026-09-30', previousFrom: '2026-08-01', previousTo: '2026-08-31'
  })
  assert.deepEqual(periodRange('THIS_YEAR', '2026-10-06'), {
    from: '2026-01-01', to: '2026-10-06', previousFrom: '2025-01-01', previousTo: '2025-10-06'
  })
  assert.deepEqual(periodRange('CUSTOM', '2026-10-06', '2026-09-29', '2026-10-02'), {
    from: '2026-09-29', to: '2026-10-02', previousFrom: '2026-09-25', previousTo: '2026-09-28'
  })
  assert.equal(periodRange('CUSTOM', '2026-10-06', '2026-10-03', '2026-10-02'), null)
  assert.equal(periodRange('CUSTOM', '2026-10-06', '2026-13-01', '2026-13-02'), null)
  assert.equal(manilaDateKey('2026-09-30T17:00:00Z'), '2026-10-01')
  assert.equal(manilaDateKey('invalid'), '')
})

test('exported key insights use the same comparison and service labels as the dashboard', () => {
  assert.equal(typeof analyticsModule.analyticsInsights, 'function')
  const range = periodRange('THIS_MONTH', '2026-10-07')
  const empty = analyticsForRange({ range })
  assert.deepEqual(analyticsModule.analyticsInsights(empty), [
    { label: 'Violation change', value: 'No violations in either period' },
    { label: 'Active service', value: '0 assignments' },
    { label: 'Service completion', value: 'No assignments' },
    { label: 'Overdue assignments', value: 'Data unavailable' }
  ])
  const active = { ...empty, violationCount: 2, previousViolationCount: 4, service: { active: 1, total: 2, completionPercent: 50 } }
  assert.equal(analyticsModule.analyticsInsights(active)[0].value, '↓ 50% violations vs previous period')
  assert.equal(analyticsModule.analyticsInsights(active)[1].value, '1 assignment')
  assert.equal(analyticsModule.analyticsInsights(active)[2].value, '50%')
  assert.equal(analyticsModule.analyticsInsights({ ...active, previousViolationCount: 0 })[0].value, '2 violations; no prior baseline')
})

test('analytics use current offense indicators, student programs, and assignment status', () => {
  const students = [
    { id: 1, program: 'BSIT' }, { id: 2, strand: 'STEM' }, { id: 3 }
  ]
  const violations = [
    { id: 1, student_id: 1, incident_date: '2026-10-01', offense_indicator_level: 'MINOR_1' },
    { id: 2, student_id: 1, incident_date: '2026-10-06', offense_indicator_level: 'MINOR_2' },
    { id: 3, student_id: 2, incident_date: '2026-10-06', offense_indicator_level: 'GRAVE' },
    { id: 4, student_id: 3, incident_date: '2026-10-06', offense_indicator_level: 'MAJOR_LEVEL' },
    { id: 5, student_id: 1, incident_date: '2026-09-05', offense_indicator_level: 'MINOR_2' }
  ]
  const assignments = [
    { id: 1, student_id: 1, assigned_at: '2026-09-30T17:00:00Z', status: 'COMPLETED' },
    { id: 2, student_id: 2, assigned_at: '2026-10-02T00:00:00Z', status: 'IN_PROGRESS' },
    { id: 3, student_id: 3, assigned_at: '2026-10-02T00:00:00Z', status: 'OPEN' }
  ]
  const range = periodRange('THIS_MONTH', '2026-10-06')
  const all = analyticsForRange({ students, violations, assignments, range })
  assert.deepEqual(all.classifications.map(({ count }) => count), [1, 1, 1, 1])
  assert.deepEqual(all.programs.map(({ label, count }) => [label, count]), [['BSIT', 2], ['Not recorded', 1], ['STEM', 1]])
  assert.equal(all.violationCount, 4)
  assert.equal(all.previousViolationCount, 1)
  assert.deepEqual(all.service, { completed: 1, active: 2, total: 3, completionPercent: 33 })
  assert.equal(all.trend.reduce((sum, bucket) => sum + bucket.count, 0), 4)
  assert.ok(all.trend.length <= 12)

  const program = analyticsForRange({ students, violations, assignments, range, program: 'BSIT' })
  assert.equal(program.violationCount, 2)
  assert.deepEqual(program.service, { completed: 1, active: 0, total: 1, completionPercent: 100 })
  const empty = analyticsForRange({ students, violations: [], assignments: [], range })
  assert.equal(empty.violationCount, 0)
  assert.equal(empty.service.completionPercent, 0)
})
