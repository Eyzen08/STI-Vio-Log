const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/authRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('auth routes expose password login and rate-limited Google endpoints', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/login' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/auth/google/link' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/auth/google/login' && route.methods.includes('post')));
  assert.equal(routes.some((route) => route.path.includes('/department/')), false);
});
