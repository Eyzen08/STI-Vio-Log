const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/messageRoutes');

test('messaging API is append-only and exposes no edit or delete route', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'get /conversations', 'post /conversations', 'get /conversations/:id',
    'post /conversations/:id/messages', 'patch /conversations/:id/read'
  ]);
  assert.equal(routes.some((route) => route.startsWith('put ') || route.startsWith('delete ')), false);
});
