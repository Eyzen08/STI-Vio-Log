const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/messageRoutes');
const pool = require('../src/config/database');
const { getConversation } = require('../src/controllers/messageController');

test('messaging API is append-only and exposes no edit or delete route', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'get /conversations', 'post /conversations', 'get /conversations/:id',
    'post /conversations/:id/messages', 'patch /conversations/:id/read'
  ]);
  assert.equal(routes.some((route) => route.startsWith('put ') || route.startsWith('delete ')), false);
});

test('admin conversation lookup uses a contiguous PostgreSQL parameter list', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return calls.length === 1
      ? { rows: [{ id: 12, subject: 'Community service', status: 'OPEN' }] }
      : { rows: [] };
  };

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  try {
    await getConversation({ user: { id: 7, role: 'ADMIN' }, params: { id: '12' } }, response);
    assert.equal(response.statusCode, 200);
    assert.match(calls[0].sql, /mc\.id = \$1 AND TRUE/);
    assert.deepEqual(calls[0].values, [12]);
  } finally {
    pool.query = originalQuery;
  }
});
