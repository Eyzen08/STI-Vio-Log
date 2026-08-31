const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/communityServiceRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('community service routes expose full CRUD surface', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/assignment-options' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/results/pending' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/results/:sessionId/review' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('put')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('delete')));
});
