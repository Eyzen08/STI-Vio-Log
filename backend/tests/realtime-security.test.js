const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { room, loadSocketAuthorization, synchronizeSocketAuthorization } = require('../src/realtime');

test('realtime rooms isolate users, roles, and departments', () => {
  assert.equal(room.user(12), 'user:12');
  assert.equal(room.role('DISCIPLINE_OFFICE'), 'role:DISCIPLINE_OFFICE');
  assert.equal(room.department(7), 'department:7');
  assert.notEqual(room.department(7), room.department(8));
});

test('socket authentication revalidates the opaque session and account state', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/realtime.js'), 'utf8');
  assert.match(source, /sessions\.parseCookies/);
  assert.match(source, /bs\.token_hash=\$1/);
  assert.match(source, /bs\.revoked_at IS NULL/);
  assert.match(source, /u\.is_active=TRUE/);
  assert.match(source, /bs\.absolute_expires_at>CURRENT_TIMESTAMP/);
  assert.match(source, /must_change_password/);
  assert.match(source, /synchronizeSocketAuthorization/);
  assert.match(source, /fetchSockets/);
  assert.match(source, /realtime_forced_disconnect/);
});

test('realtime authorization uses current session, role, and department state', async () => {
  const database = { async query(_sql, params) { assert.deepEqual(params, [11]); return { rows:[{ browser_session_id:11,id:7,role:'DEPARTMENT_HEAD',department_id:3,must_change_password:false }] }; } };
  assert.deepEqual(await loadSocketAuthorization(11, database), { session_id:11,id:7,role:'DEPARTMENT_HEAD',department_id:3 });
  const revoked = { async query() { return { rows:[] }; } };
  assert.equal(await loadSocketAuthorization(11, revoked), null);
});

test('realtime synchronization removes stale rooms and disconnects revoked sessions', async () => {
  const rooms = new Set(['socket-1',room.user(7),room.role('DEPARTMENT_HEAD'),room.department(3)]);
  const socket = { id:'socket-1', data:{sessionId:11}, user:{id:7,role:'DEPARTMENT_HEAD',department_id:3}, rooms,
    async leave(value){rooms.delete(value)}, async join(value){rooms.add(value)}, disconnect(){this.disconnected=true} };
  const changed = { async query(){return{rows:[{browser_session_id:11,id:7,role:'DISCIPLINE_OFFICE',department_id:4,must_change_password:false}]}} };
  await synchronizeSocketAuthorization(socket, changed);
  assert.equal(rooms.has(room.role('DEPARTMENT_HEAD')), false);
  assert.equal(rooms.has(room.department(3)), false);
  assert.equal(rooms.has(room.role('DISCIPLINE_OFFICE')), true);
  assert.equal(rooms.has(room.department(4)), true);
  await synchronizeSocketAuthorization(socket, {async query(){return{rows:[]}}});
  assert.equal(socket.disconnected, true);
});

test('both direct and QR attendance paths publish scoped refresh events', () => {
  const direct = fs.readFileSync(path.join(__dirname, '../src/controllers/communityServiceAttendanceController.js'), 'utf8');
  const qr = fs.readFileSync(path.join(__dirname, '../src/controllers/qrController.js'), 'utf8');
  assert.match(direct, /emitAttendanceChange\(result, req\.staffDepartmentId\)/);
  assert.match(qr, /emitAttendanceChange\(result, req\.staffDepartmentId\)/);
});

test('service result reviews publish scoped refresh events for progress updates', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers/communityServiceAttendanceController.js'), 'utf8');
  assert.match(source, /emitCommunityServiceChange\(\{assignmentId:result\.session\.assignment_id,departmentId:result\.session\.department_id,action:/);
  assert.match(source, /REVIEW_APPROVED/);
  assert.match(source, /REVIEW_REJECTED/);
});
