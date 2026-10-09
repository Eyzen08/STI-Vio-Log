const test = require('node:test');
const assert = require('node:assert/strict');
const { insertNotification, notifyStudent, notifyAttendanceStaff } = require('../src/services/notificationService');

test('attendance alerts include active office staff without requiring a department assignment', async () => {
  let recipientSql;
  const inserts = [];
  const client = { query: async (sql, params) => {
    if (sql.includes('CROSS JOIN departments')) return { rows: [{ first_name: 'Test', last_name: 'Student', student_number: '123', department_name: 'Library' }] };
    if (sql.includes('SELECT DISTINCT u.id')) {
      recipientSql = sql;
      return { rows: [{ id: 1 }, { id: 2 }] };
    }
    inserts.push(params);
    return { rows: [{ id: inserts.length }] };
  } };
  await notifyAttendanceStaff(client, { studentId: 3, departmentId: 4, sessionId: 5, assignmentId: 6, action: 'TIME_IN' });
  assert.match(recipientSql, /u\.is_active=TRUE/);
  assert.match(recipientSql, /u\.role IN \('DISCIPLINE_ADMIN',\s*'DISCIPLINE_OFFICE'\)/);
  assert.doesNotMatch(recipientSql, /officer_department_assignments/);
  assert.deepEqual(inserts.map(params => params[0]), [1, 2]);
  assert.deepEqual(inserts.map(params => params[4]), ['attendance:5:time_in:event:1', 'attendance:5:time_in:event:2']);
});

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
  assert.deepEqual(calls[0].params, [7, 'Service assigned', 'You have a new assignment.', 'SERVICE_ASSIGNED', 'service:12:assigned:student', 'SYSTEM', 'INFO', null, null, null, '{}']);
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

test('attendance targets retain both the exact session and its assignment', async () => {
  const inserts = [];
  const client = { query: async (sql, params) => {
    if (sql.includes('CROSS JOIN departments')) return { rows: [{ first_name: 'Test', last_name: 'Student', student_number: '123', department_name: 'Library' }] };
    if (sql.includes('SELECT DISTINCT u.id')) return { rows: [{ id: 7 }] };
    inserts.push(params);
    return { rows: [{ id: 44 }] };
  } };
  await notifyAttendanceStaff(client, { studentId: 3, departmentId: 4, sessionId: 5, assignmentId: 6, action: 'TIME_OUT' });
  assert.equal(inserts[0][7], 'community_service_sessions');
  assert.equal(inserts[0][8], 5);
  assert.equal(inserts[0][9], '/admin/community-service?assignment_id=6&session_id=5');
  assert.equal(JSON.parse(inserts[0][10]).assignment_id, 6);
  await notifyAttendanceStaff(client, { studentId: 3, departmentId: 4, action: 'SCAN_REJECTED' });
  assert.equal(inserts[1][7], 'students');
  assert.equal(inserts[1][8], 3);
  assert.equal(inserts[1][9], '/admin/students?student_id=3');
});
