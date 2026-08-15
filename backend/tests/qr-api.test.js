const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/qrRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('qr routes expose time-in and time-out endpoints', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/scan' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/time-in' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/time-out' && route.methods.includes('post')));
});
