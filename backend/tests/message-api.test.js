const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/messageRoutes');
const pool = require('../src/config/database');
const { assertConversation, getConversation, updateConversationStatus } = require('../src/controllers/messageController');

test('messaging API is append-only and exposes no edit or delete route', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'get /conversations', 'get /recipients', 'post /conversations', 'get /conversations/:id',
    'post /conversations/:id/messages', 'patch /conversations/:id/read', 'patch /conversations/:id/status'
  ]);
  assert.equal(routes.some((route) => route.startsWith('put ') || route.startsWith('delete ')), false);
});

test('student and department-head conversation lookups enforce authenticated ownership', async () => {
  const calls = [];
  const executor = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ id: 12 }] }; } };

  await assertConversation({ id: 44, role: 'STUDENT' }, '12', executor);
  assert.match(calls[0].sql, /own_student\.user_id=\$2/);
  assert.deepEqual(calls[0].values, [12, 44]);

  await assertConversation({ id: 55, role: 'DEPARTMENT_HEAD', department_id: 9 }, '12', executor);
  assert.match(calls[1].sql, /assigned_department_id=\$2/);
  assert.deepEqual(calls[1].values, [12, 9]);
});

test('students cannot change an official conversation status', async () => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await updateConversationStatus({ user: { id: 44, role: 'STUDENT' }, params: { id: '12' }, body: { status: 'CLOSED' } }, response);
  assert.equal(response.statusCode, 403);
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
    await getConversation({ user: { id: 7, role: 'ADMIN' }, params: { id: '12' }, query: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.match(calls[0].sql, /mc\.id = \$1 AND TRUE/);
    assert.deepEqual(calls[0].values, [12]);
  } finally {
    pool.query = originalQuery;
  }
});
