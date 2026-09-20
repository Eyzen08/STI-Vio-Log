const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const router = require('../src/routes/messageRoutes');
const pool = require('../src/config/database');
const { assertConversation, getConversation, getUnreadCount, listRecipients, updateConversationStatus } = require('../src/controllers/messageController');

test('messaging API is append-only and exposes no edit or delete route', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'get /conversations', 'get /unread-count', 'get /recipients', 'post /conversations', 'get /conversations/:id',
    'post /conversations/:id/messages', 'patch /conversations/:id/read', 'patch /conversations/:id/status'
  ]);
  assert.equal(routes.some((route) => route.startsWith('put ') || route.startsWith('delete ')), false);
});

test('unread count uses ownership scope without loading message previews', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, values) => { calls.push({ sql:String(sql), values }); return { rows:[{ unread_total:3 }] }; };
  const response = { statusCode:200, status(code){this.statusCode=code;return this}, json(body){this.body=body;return this} };
  try {
    await getUnreadCount({ user:{ id:44, role:'STUDENT' }, query:{} }, response);
    assert.deepEqual(response.body, { success:true, unread_total:3 });
    assert.match(calls[0].sql, /own_student\.user_id=\$2/);
    assert.doesNotMatch(calls[0].sql, /message_preview|subject/);
    assert.deepEqual(calls[0].values, [44,44]);

    await getUnreadCount({ user:{ id:7, role:'DISCIPLINE_ADMIN' }, query:{} }, response);
    assert.match(calls[1].sql, /WHERE TRUE/);
    assert.deepEqual(calls[1].values, [7]);
  } finally { pool.query = originalQuery; }
});

test('student conversation lookups enforce authenticated ownership', async () => {
  const calls = [];
  const executor = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ id: 12 }] }; } };

  await assertConversation({ id: 44, role: 'STUDENT' }, '12', executor);
  assert.match(calls[0].sql, /own_student\.user_id=\$2/);
  assert.deepEqual(calls[0].values, [12, 44]);

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

test('student recipients are limited to the Discipline Office', async () => {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await listRecipients({ user: { id: 44, role: 'STUDENT' }, query: {} }, response);
  assert.deepEqual(response.body, { success: true, recipients: [{ type: 'DISCIPLINE_OFFICE', id: null, name: 'Discipline Office', role: 'DISCIPLINE_OFFICE' }] });

  const source = fs.readFileSync(require.resolve('../src/controllers/messageController'), 'utf8');
  assert.match(source, /studentRole \? \['subject','message'\]/);
  assert.doesNotMatch(source, /assertAllowedFields\(req\.body,[^\n]*recipient_department_id/);
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
