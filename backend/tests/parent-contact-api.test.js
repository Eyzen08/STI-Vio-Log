const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/parentContactRoutes');

test('parent contact routes expose read and append-only recording', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  assert(routes.some((route) => route.path === '/:studentId' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:studentId' && route.methods.includes('post')));
  assert.equal(routes.some((route) => route.methods.includes('put') || route.methods.includes('delete')), false);
});

