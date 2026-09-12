import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const boundary = await readFile(new URL('../src/components/RouteErrorBoundary.jsx', import.meta.url), 'utf8')

test('department student, follow-up, and attendance screens remain in the stable entry bundle', () => {
  assert.match(app, /import DepartmentStudents from '\.\/components\/DepartmentStudents\.jsx'/)
  assert.match(app, /import DepartmentNonCompliance from '\.\/components\/DepartmentNonCompliance\.jsx'/)
  assert.match(app, /import DepartmentDtr from '\.\/components\/DepartmentDtr\.jsx'/)
  assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/components\/DepartmentStudents\.jsx'\)\)/)
  assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/components\/DepartmentNonCompliance\.jsx'\)\)/)
  assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/components\/DepartmentDtr\.jsx'\)\)/)
})

test('stale deployment chunks reload once and route errors show recovery UI', () => {
  assert.match(main, /vite:preloadError/)
  assert.match(main, /window\.location\.reload\(\)/)
  assert.match(app, /<RouteErrorBoundary key=\{isLoggedIn\?routePath:'public-auth'\}>/)
  assert.match(boundary, /Reload portal/)
})

test('public authentication routes preserve in-progress OTP state', () => {
  assert.match(app, /key=\{isLoggedIn\?routePath:'public-auth'\}/)
})
