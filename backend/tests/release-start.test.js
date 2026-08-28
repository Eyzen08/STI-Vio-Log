const test = require('node:test');
const assert = require('node:assert/strict');
const packageJson = require('../package.json');

test('production startup applies and verifies migrations before serving traffic', () => {
  const start = packageJson.scripts.start;
  assert.match(start, /^npm run migrate && npm run production:check && node src\/server\.js$/);
});
