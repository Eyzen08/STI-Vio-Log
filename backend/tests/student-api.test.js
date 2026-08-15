const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/studentRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('student routes expose full CRUD surface', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('put')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('delete')));
});
