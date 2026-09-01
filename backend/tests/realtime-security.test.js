const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { room } = require('../src/realtime');

test('realtime rooms isolate users, roles, and departments', () => {
  assert.equal(room.user(12), 'user:12');
  assert.equal(room.role('DISCIPLINE_OFFICE'), 'role:DISCIPLINE_OFFICE');
  assert.equal(room.department(7), 'department:7');
  assert.notEqual(room.department(7), room.department(8));
});

test('socket authentication revalidates account state and session version', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/realtime.js'), 'utf8');
  assert.match(source, /jwt\.verify\(token, getJwtSecret\(\)\)/);
  assert.match(source, /u\.is_active=TRUE/);
  assert.match(source, /decoded\.session_version/);
  assert.match(source, /must_change_password/);
  assert.match(source, /socket\.join\(room\.department\(socket\.user\.department_id\)\)/);
});

test('both direct and QR attendance paths publish scoped refresh events', () => {
  const direct = fs.readFileSync(path.join(__dirname, '../src/controllers/communityServiceAttendanceController.js'), 'utf8');
  const qr = fs.readFileSync(path.join(__dirname, '../src/controllers/qrController.js'), 'utf8');
  assert.match(direct, /emitAttendanceChange\(result, req\.staffDepartmentId\)/);
  assert.match(qr, /emitAttendanceChange\(result, req\.staffDepartmentId\)/);
});
