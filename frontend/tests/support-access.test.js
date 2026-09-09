import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const read = (file) => fs.readFileSync(path.join(testDirectory, '..', file), 'utf8')

test('support access has separate system request and discipline approval routes', () => {
  const routes = read('src/lib/routes.js')
  assert.match(routes, /\/system\/support-access[^\n]+SYSTEM_ADMIN/)
  assert.match(routes, /\/admin\/support-access[^\n]+DISCIPLINE_ADMIN/)
})

test('support access UI is exact-scope, time-limited, and read-only', () => {
  const panel = read('src/components/SupportAccessPanel.jsx')
  assert.match(panel, /Exact requested scopes/)
  assert.match(panel, /duration_minutes/)
  assert.match(panel, /read_only:true/)
  assert.match(panel, /Write access is intentionally unavailable/)
  assert.match(panel, /Approve exact scopes/)
})
