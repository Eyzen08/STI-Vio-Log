const test = require('node:test');
const assert = require('node:assert/strict');
const { insertNotification, notifyStudent } = require('../src/services/notificationService');

test('insertNotification writes a retry-safe event without recipient-controlled data', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: 44 }] };
  } };
  const result = await insertNotification(client, {
    userId: 7,
    title: 'Service assigned',
    message: 'You have a new assignment.',
    type: 'SERVICE_ASSIGNED',
    eventKey: 'service:12:assigned:student'
  });
  assert.deepEqual(result, { id: 44 });
  assert.match(calls[0].sql, /ON CONFLICT \(event_key\).*DO NOTHING/s);
  assert.deepEqual(calls[0].params, [7, 'Service assigned', 'You have a new assignment.', 'SERVICE_ASSIGNED', 'service:12:assigned:student']);
});

test('notifyStudent resolves the recipient from the student record', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT user_id')) return { rows: [{ user_id: 91 }] };
    return { rows: [{ id: 45 }] };
  } };
  await notifyStudent(client, 33, { title: 'Time in recorded', message: 'Attendance started.', type: 'SERVICE_TIME_IN', eventKey: 'session:2:time-in' });
  assert.deepEqual(calls[0].params, [33]);
  assert.equal(calls[1].params[0], 91);
});
