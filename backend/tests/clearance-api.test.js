const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/clearanceRoutes');

function getRouteSummary() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));
}

test('clearance routes expose full CRUD surface', () => {
  const routes = getRouteSummary();

  assert(routes.some((route) => route.path === '/' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/' && route.methods.includes('post')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('get')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('put')));
  assert(routes.some((route) => route.path === '/:id' && route.methods.includes('delete')));
  for (const [path, method] of [['/certificates/eligible','get'],['/certificates','get'],['/certificates','post'],['/certificates/:id/pdf','get'],['/certificates/:id/revoke','post'],['/certificates/:id/email','post'],['/signatures','get'],['/signatures','post'],['/signatures/:id','put']]) {
    assert(routes.some((route) => route.path === path && route.methods.includes(method)), `missing ${method} ${path}`);
  }
});
