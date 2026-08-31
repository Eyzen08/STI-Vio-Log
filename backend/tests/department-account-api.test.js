const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/departmentAccountRoutes');

const routes = () => router.stack.filter(layer => layer.route).map(layer => ({path:layer.route.path,methods:Object.keys(layer.route.methods)}));

test('Department Account administration exposes only narrow credential operations',()=>{
  const surface=routes();
  assert(surface.some(route=>route.path==='/'&&route.methods.includes('get')));
  assert(surface.some(route=>route.path==='/'&&route.methods.includes('post')));
  assert(surface.some(route=>route.path==='/options'&&route.methods.includes('get')));
  assert(surface.some(route=>route.path==='/:id/status'&&route.methods.includes('patch')));
  assert(surface.some(route=>route.path==='/:id/password-reset'&&route.methods.includes('post')));
  assert.equal(surface.some(route=>route.path.includes('assignment')),false);
});
