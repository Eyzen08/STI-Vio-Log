const test = require('node:test');
const assert = require('node:assert/strict');
const packageJson = require('../package.json');

test('production startup verifies readiness without mutating the database', () => {
  const start = packageJson.scripts.start;
  assert.equal(start, 'npm run production:check && node src/server.js');
  assert.doesNotMatch(start, /migrate/);
});
