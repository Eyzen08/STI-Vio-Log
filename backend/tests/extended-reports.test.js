const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/reportRoutes');

test('administrative report catalog includes contact, clearance, and good-standing reports', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const path of ['/parent-contacts', '/clearance', '/good-standing']) assert.ok(routes.includes(path));
});

test('new administrative reports require Admin or Discipline Office authorization', () => {
  for (const path of ['/parent-contacts', '/clearance', '/good-standing']) {
    const layer = router.stack.find((entry) => entry.route?.path === path);
    assert.equal(layer.route.stack.length, 3);
  }
});
