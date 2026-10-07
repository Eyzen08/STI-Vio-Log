const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { listMigrationFiles } = require('../scripts/migrate');
const { testDatabaseConfig } = require('./testDatabase');

require('dotenv').config({ quiet: true });

const schemaName = `sti_vio_log_test_${process.pid}_${Date.now()}`.toLowerCase();

if (!/^sti_vio_log_test_[a-z0-9_]+$/.test(schemaName)) {
  throw new Error('Refusing to use an unguarded PostgreSQL test schema');
}

process.env.DB_SCHEMA = schemaName;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'q'.repeat(48);

const dedicatedDatabase = testDatabaseConfig();
process.env.DATABASE_URL = dedicatedDatabase.connectionString;
const adminPool = new Pool(dedicatedDatabase);

let app;
let pool;
let server;
let baseUrl;

const migrationsDirectory = path.resolve(__dirname, '../../database/migrations');
const migrationFiles = listMigrationFiles(migrationsDirectory).map((name) => path.join(migrationsDirectory, name));

async function request(route, { token, method = 'GET', body } = {}) {
  if (route.endsWith('/time-in') && body && !body.session_type) body={...body,session_type:'OPEN_TIME',selected_duration_minutes:null};
  if (route.endsWith('/time-out') && body && !body.session_id) {
    const active=(await pool.query('SELECT css.id FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN students s ON s.id=a.student_id WHERE css.time_out IS NULL AND (s.qr_code=$1 OR a.id=$2) ORDER BY css.id DESC LIMIT 1',[body.qr_code||null,body.assignment_id||null])).rows[0];
    body={...body,session_id:active?.id||999999};
  }
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Cookie: token.cookie, 'X-CSRF-Token': token.csrf } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function tokenFor(user) {
  const sessions = require('../src/services/browserSessionService');
  const created = await sessions.createSession({ userId: user.id, database: pool });
  return { cookie: `sti_session=${created.token}; sti_csrf=${created.csrf}`, csrf: created.csrf };
}

async function resetAndSeedTestData() {
  await pool.query(`
    TRUNCATE TABLE
      audit_logs,
      community_service_progress_history,
      community_service_sessions,
      community_service_attendance,
      community_service_assignments,
      violation_actions,
      student_clearance,
      violations,
      students,
      department_heads,
      departments,
      users
    RESTART IDENTITY CASCADE
  `);

  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('test-password', 4);
  await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES
      ('admin_test', $1, 'DISCIPLINE_ADMIN'),
      ('discipline_test', $1, 'DISCIPLINE_ADMIN'),
      ('head_test', $1, 'DEPARTMENT_HEAD'),
      ('student_test', $1, 'STUDENT')`,
    [passwordHash]
  );
  await pool.query(
    `INSERT INTO departments (department_code, department_name)
     VALUES ('TEST', 'Test Department')`
  );
  await pool.query(
    `INSERT INTO department_heads (user_id, department_id, first_name, last_name)
     SELECT u.id, d.id, 'Department', 'Head'
     FROM users u CROSS JOIN departments d
     WHERE u.username = 'head_test' AND d.department_code = 'TEST'`
  );
  await pool.query("UPDATE department_heads SET qr_scanner_enabled=TRUE WHERE user_id=(SELECT id FROM users WHERE username='head_test')");
  await pool.query(
    `INSERT INTO officer_department_assignments
       (officer_user_id,department_id,assignment_type,reason,status,created_by_admin_id)
     SELECT head.id,d.id,'PERMANENT','Integration test responsibility','ACTIVE',admin.id
     FROM users head CROSS JOIN departments d CROSS JOIN users admin
     WHERE head.username='head_test' AND d.department_code='TEST' AND admin.username='admin_test'`
  );
  await pool.query(
    `INSERT INTO students (
      user_id, student_number, first_name, last_name, program,
      section, year_level, qr_code
     ) SELECT id, '02000123456', 'Test', 'Student', 'BSIT', 'A', 2, 'QR-TEST'
       FROM users WHERE username = 'student_test'`
  );
}

async function createViolation(token, studentId) {
  const result = await request('/api/violations', {
    token,
    method: 'POST',
    body: {
      student_id: studentId,
      violation_type_id: 1,
      incident_date: '2026-08-27',
      description: 'Lifecycle integration test'
    }
  });
  assert.equal(result.status, 201);
  return result.body.violation;
}

async function act(token, violationId, action, reason) {
  return request(`/api/violations/${violationId}/actions`, {
    token,
    method: 'POST',
    body: { action, ...(reason === undefined ? {} : { reason }) }
  });
}

async function edit(token, violationId, fields) {
  return request(`/api/violations/${violationId}`, { token, method: 'PUT', body: { reason: 'Verified case correction', ...fields } });
}

async function assignService(token, violationId, studentId, requiredHours) {
  const destination = (await pool.query(
    `SELECT d.id AS department_id, dh.id AS department_head_id
     FROM departments d JOIN department_heads dh ON dh.department_id = d.id
     WHERE d.department_code = 'TEST'`
  )).rows[0];
  return request('/api/community-service', {
    token,
    method: 'POST',
    body: { violation_id: violationId, student_id: studentId, required_hours: requiredHours, ...destination }
  });
}

async function login(username) {
  const user = (await pool.query('SELECT id, username, role FROM users WHERE username=$1', [username])).rows[0];
  assert.ok(user, `missing seeded user ${username}`);
  return tokenFor(user);
}

async function createServiceViolation(token, studentId, requiredHours) {
  const result = await request('/api/violations', {
    token,
    method: 'POST',
    body: {
      student_id: studentId,
      violation_type_id: 1,
      incident_date: '2026-08-27',
      description: 'DTR session integration test'
    }
  });
  assert.equal(result.status, 201);
  const assignment = await assignService(token, result.body.violation.id, studentId, requiredHours);
  assert.equal(assignment.status, 201);
  return { ...result.body, assignment: assignment.body.assignment };
}

test.before(async () => {
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(file, 'utf8');
    await adminPool.query(`SET search_path TO ${schemaName}`);
    await adminPool.query(sql);
  }

  pool = require('../src/config/database');
  // These lifecycle tests move recorded starts back by minutes. Keep their clock at
  // Manila noon so the new midnight policy does not alter unrelated assertions.
  const wallStart=Date.now();
  const date=new Date(wallStart+8*3600000).toISOString().slice(0,10);
  const noon=Date.parse(date+'T12:00:00+08:00');
  const clockResult=()=>({rows:[{now:new Date(noon+Date.now()-wallStart)}]});
  const query=pool.query.bind(pool),connect=pool.connect.bind(pool);
  pool.query=(sql,params)=>String(sql)==='SELECT clock_timestamp() AS now'?Promise.resolve(clockResult()):query(sql,params);
  pool.connect=(callback)=>callback?connect(callback):connect().then(client=>{
    const original=client.query.bind(client),release=client.release.bind(client);
    client.query=(sql,params)=>String(sql)==='SELECT clock_timestamp() AS now'?Promise.resolve(clockResult()):original(sql,params);
    client.release=()=>{client.query=original;client.release=release;release()};return client;
  });
  app = require('../src/server');

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  await resetAndSeedTestData();
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();

  if (!/^sti_vio_log_test_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Refusing to drop an unguarded PostgreSQL schema');
  }

  await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await adminPool.end();
});

test('admin hour corrections create routed assignments and preserve attendance evidence', async () => {
  const admin = await login('admin_test');
  const head = await login('head_test');
  const student = await login('student_test');
  const studentId = (await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const violation = await createViolation(admin, studentId);
  const destination = (await pool.query('SELECT department_id, id AS department_head_id FROM department_heads LIMIT 1')).rows[0];
  const created = await edit(admin, violation.id, { required_service_hours: 3, completed_service_hours: 1, ...destination });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(Number(created.body.assignment.remaining_hours), 2);
  assert.equal(Number(created.body.hourCorrection.previous_completed_hours), 0);
  assert.equal(Number(created.body.assignment.department_id), Number(destination.department_id));
  const assignmentId = created.body.assignment.id;
  assert.equal((await request('/api/qr/time-in', { token: head, method: 'POST', body: { qr_code: 'QR-TEST' } })).status, 201);
  await pool.query("UPDATE community_service_sessions SET time_in = time_in - INTERVAL '30 minutes' WHERE assignment_id = $1", [assignmentId]);
  const timeOut = await request('/api/qr/time-out', { token: head, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'TODAYS_SERVICE_COMPLETED' } });
  assert.equal(timeOut.status, 201, JSON.stringify(timeOut.body));
  assert.equal(Number(timeOut.body.assignment.completed_hours), 1.5);
  const evidence = (await pool.query('SELECT * FROM community_service_sessions WHERE assignment_id = $1', [assignmentId])).rows;
  const reduced = await edit(admin, violation.id, { required_service_hours: 2, completed_service_hours: 0.5 });
  assert.equal(reduced.status, 200, JSON.stringify(reduced.body));
  assert.equal(Number(reduced.body.assignment.remaining_hours), 1.5);
  assert.deepEqual((await pool.query('SELECT * FROM community_service_sessions WHERE assignment_id = $1', [assignmentId])).rows, evidence);
  const history = await request(`/api/violations/${violation.id}/actions`, { token: admin });
  assert.equal(history.body.hourCorrections.length, 2);
  await assert.rejects(pool.query('UPDATE community_service_hour_corrections SET reason = $1', ['Overwrite']), /append-only/);
  await assert.rejects(pool.query('DELETE FROM community_service_hour_corrections'), /append-only/);
  const dtr = await request('/api/students/me/community-service/dtr', { token: student });
  assert.equal(dtr.status, 200, JSON.stringify(dtr.body));
  assert.equal(dtr.body.hourCorrections.length, 2);
  const report = await request('/api/reports/dtr', { token: admin });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.equal(report.body.hourCorrections.length, 2);
  assert.equal(Number(report.body.data[0].manual_adjustment_hours), 0);
  const audit = (await pool.query("SELECT previous_values, new_values, reason FROM audit_logs WHERE action = 'UPDATE' AND table_name = 'violations' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.equal(Number(audit.previous_values.completed_service_hours), 1.5);
  assert.equal(Number(audit.new_values.completed_service_hours), 0.5);
  assert.ok(audit.reason);
});

test('violation edits validate category changes, numeric hours, destinations, and admin-only credit', async () => {
  const admin = await login('admin_test');
  await pool.query("UPDATE users SET role = 'DISCIPLINE_OFFICE' WHERE username = 'discipline_test'");
  const office = await login('discipline_test');
  const studentId = (await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const { violation, assignment } = await createServiceViolation(admin, studentId, 3);
  for (const value of [-1, null, '', 'invalid', 1.234, 10000]) assert.equal((await edit(admin, violation.id, { required_service_hours: value })).status, 400);
  assert.equal((await edit(admin, violation.id, { required_service_hours: 1, completed_service_hours: 2 })).status, 400);
  assert.equal((await edit(admin, violation.id, { incident_date: '2026-02-30' })).status, 400);
  assert.equal((await edit(admin, violation.id, { reason: ' ', description: 'Facts' })).status, 400);
  assert.equal((await edit(admin, violation.id, { reason: 'x'.repeat(1001), description: 'Facts' })).status, 400);
  assert.equal((await edit(office, violation.id, { completed_service_hours: 1 })).status, 403);
  assert.equal((await edit(office, violation.id, { required_service_hours: 4 })).status, 200);
  assert.equal((await edit(admin, violation.id, { department_id: 1, department_head_id: 1 })).status, 400);
  const type = (await pool.query("SELECT * FROM violation_types WHERE violation_code = 'HANDBOOK_MAJOR_A'")).rows[0];
  assert.equal((await edit(admin, violation.id, { violation_type_id: type.id, description: 'Unclassified facts' })).status, 400);
  const offense = require('../../shared/handbookOffenses.json').HANDBOOK_MAJOR_A[0];
  const changed = await edit(admin, violation.id, { violation_type_id: type.id, description: `Handbook offense: ${offense}\nIncident details: Corrected facts`, incident_time: null });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.offenseStatus.indicator_level, 'MAJOR_LEVEL');
  assert.equal(Number(changed.body.assignment.id), Number(assignment.id));
  const unassigned = await createViolation(admin, studentId);
  assert.equal((await edit(admin, unassigned.id, { required_service_hours: 1 })).status, 400);
  assert.equal((await edit(admin, unassigned.id, { required_service_hours: 1, department_id: 99999, department_head_id: 99999 })).status, 400);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_assignments WHERE violation_id = $1', [unassigned.id])).rows[0].count, 0);
});

test('hour editing and cancellation are blocked during active attendance without losing credits', async () => {
  const admin = await login('admin_test');
  const head = await login('head_test');
  const studentId = (await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const { violation, assignment } = await createServiceViolation(admin, studentId, 3);
  const attempts = await Promise.all([
    request('/api/qr/time-in', { token: head, method: 'POST', body: { qr_code: 'QR-TEST' } }),
    edit(admin, violation.id, { required_service_hours: 4 })
  ]);
  assert.equal(attempts[0].status, 201);
  assert.ok([200, 409].includes(attempts[1].status));
  const required = Number((await pool.query('SELECT required_hours FROM community_service_assignments WHERE id = $1', [assignment.id])).rows[0].required_hours);
  assert.equal((await edit(admin, violation.id, { required_service_hours: 5 })).status, 409);
  assert.equal((await edit(admin, violation.id, { completed_service_hours: 1 })).status, 409);
  assert.equal((await act(admin, violation.id, 'INVALID_CANCEL', 'Duplicate')).status, 409);
  assert.equal((await act(admin, violation.id, 'CLEAR', 'Administrative closure')).status, 409);
  assert.equal((await request(`/api/community-service/${assignment.id}`, { token: admin, method: 'PUT', body: { required_hours: 5, reason: 'Requirement correction' } })).status, 409);
  assert.equal((await edit(admin, violation.id, { description: 'Metadata can be corrected while attendance continues' })).status, 200);
  await pool.query("UPDATE community_service_sessions SET time_in = time_in - INTERVAL '30 minutes' WHERE assignment_id = $1", [assignment.id]);
  const timedOut = await request('/api/qr/time-out', { token: head, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'TODAYS_SERVICE_COMPLETED' } });
  assert.equal(timedOut.status, 201);
  assert.equal(Number(timedOut.body.assignment.completed_hours), 0.5);
  assert.equal(Number(timedOut.body.assignment.required_hours), required);
  const corrected = await edit(admin, violation.id, { completed_service_hours: 1 });
  assert.equal(corrected.status, 200, JSON.stringify(corrected.body));
  const cancelled = await act(admin, violation.id, 'INVALID_CANCEL', 'Confirmed duplicate');
  assert.equal(cancelled.body.assignment.status, 'INVALID_CANCELLED');
  assert.equal(cancelled.body.offenseStatus.indicator_level, 'NEUTRAL');
  assert.equal(cancelled.body.clearanceSync.eligible, true);
  const cancelledHistory = await request(`/api/violations/student/${studentId}`, { token: admin });
  assert.deepEqual(cancelledHistory.body.summary.categoryCounts, []);
  assert.equal(cancelledHistory.body.summary.remainingHours, 0);
  const serviceReport = await request('/api/reports/community-service', { token: admin });
  assert.equal(serviceReport.body.total_pending_hours, 0);
  assert.equal((await edit(admin, violation.id, { description: 'Closed edit' })).status, 409);
  assert.equal((await act(admin, violation.id, 'REOPEN', 'Correction required')).status, 200);
  assert.equal((await request(`/api/violations/${violation.id}/actions`, { token: admin })).body.hourCorrections.length, 1);
});

test('fully credited positive hours complete the violation; zero-hour edits remain open', async () => {
  const admin = await login('admin_test');
  const studentId = (await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const { violation } = await createServiceViolation(admin, studentId, 2);
  const complete = await edit(admin, violation.id, { completed_service_hours: 2 });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.violation.status, 'COMPLETE');
  assert.equal(complete.body.assignment.status, 'COMPLETED');
  assert.equal(complete.body.clearanceSync.eligible, true);
  assert.equal((await edit(admin, violation.id, { completed_service_hours: 1 })).status, 409);
  await act(admin, violation.id, 'REOPEN', 'Review credited hours');
  const zero = await edit(admin, violation.id, { required_service_hours: 0, completed_service_hours: 0 });
  assert.equal(zero.status, 200, JSON.stringify(zero.body));
  assert.equal(zero.body.violation.status, 'OPEN');
  assert.equal(Number(zero.body.assignment.remaining_hours), 0);
});

test('failed edit audit rolls back new assignment, hour corrections, and violation changes', async () => {
  const admin = await login('admin_test');
  const studentId = (await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const violation = await createViolation(admin, studentId);
  const destination = (await pool.query('SELECT department_id, id AS department_head_id FROM department_heads LIMIT 1')).rows[0];
  await pool.query(`CREATE FUNCTION fail_edit_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'UPDATE' AND NEW.table_name = 'violations' THEN RAISE EXCEPTION 'forced edit audit failure'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER fail_edit_audit_trigger BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_edit_audit()');
  try {
    assert.equal((await edit(admin, violation.id, { required_service_hours: 2, completed_service_hours: 1, ...destination })).status, 500);
    assert.equal(Number((await pool.query('SELECT required_service_hours FROM violations WHERE id = $1', [violation.id])).rows[0].required_service_hours), 0);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_assignments')).rows[0].count, 0);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_hour_corrections')).rows[0].count, 0);
  } finally {
    await pool.query('DROP TRIGGER fail_edit_audit_trigger ON audit_logs');
    await pool.query('DROP FUNCTION fail_edit_audit()');
  }
});

test('violation lifecycle transitions preserve structured history and audit records', async () => {
  const users = Object.fromEntries(
    (await pool.query('SELECT id, username, role FROM users')).rows.map((user) => [user.username, user])
  );
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const adminToken = await tokenFor(users.admin_test);
  const disciplineToken = await tokenFor(users.discipline_test);

  const completeViolation = await createViolation(adminToken, studentId);
  assert.equal((await act(adminToken, completeViolation.id, 'COMPLETE')).status, 200);
  assert.equal((await act(adminToken, completeViolation.id, 'REOPEN', 'Additional review required')).body.violation.status, 'OPEN');

  const clearViolation = await createViolation(disciplineToken, studentId);
  assert.equal((await act(disciplineToken, clearViolation.id, 'CLEAR', 'Administrative resolution')).body.violation.status, 'CLEAR');
  assert.equal((await act(disciplineToken, clearViolation.id, 'REOPEN', 'Resolution reversed')).body.violation.status, 'OPEN');

  const invalidViolation = await createViolation(adminToken, studentId);
  assert.equal((await act(adminToken, invalidViolation.id, 'INVALID_CANCEL', 'Duplicate record')).body.violation.status, 'INVALID_CANCEL');
  assert.equal((await act(adminToken, invalidViolation.id, 'REOPEN', 'Record confirmed valid')).body.violation.status, 'OPEN');

  const chainedViolation = await createViolation(adminToken, studentId);
  assert.equal((await act(adminToken, chainedViolation.id, 'COMPLETE')).status, 200);
  assert.equal((await act(adminToken, chainedViolation.id, 'REOPEN', 'Recheck')).status, 200);
  assert.equal((await act(adminToken, chainedViolation.id, 'CLEAR', 'Administrative closure')).status, 200);
  assert.equal((await act(adminToken, chainedViolation.id, 'REOPEN', 'New evidence')).status, 200);
  assert.equal((await act(adminToken, chainedViolation.id, 'INVALID_CANCEL', 'Wrong student')).status, 200);

  const history = await request(`/api/violations/${chainedViolation.id}/actions`, { token: adminToken });
  assert.deepEqual(history.body.actions.map((item) => item.action), ['CREATE', 'COMPLETE', 'REOPEN', 'CLEAR', 'REOPEN', 'INVALID_CANCEL']);
  assert.equal(history.body.actions[3].reason, 'Administrative closure');
  assert.ok(history.body.actions.every((item) => item.created_at));
  assert.ok(history.body.actions.every((item) => item.performed_by_user_id));
  assert.ok(history.body.actions.every((item) => item.performed_by_role));

  const studentToken = await tokenFor(users.student_test);
  const selfRecords = await request('/api/students/me/violations', { token: studentToken });
  assert.equal(selfRecords.status, 200);
  const selfViolation = selfRecords.body.violations.find((item) => item.id === chainedViolation.id);
  assert.equal(selfViolation.violation_name, 'Minor Violation');
  assert.equal(selfViolation.severity, 'MINOR');
  assert.deepEqual(selfViolation.history.map((item) => item.action), ['CREATE', 'COMPLETE', 'REOPEN', 'CLEAR', 'REOPEN', 'INVALID_CANCEL']);
  assert.ok(selfViolation.history.every((item) => !Object.hasOwn(item, 'performed_by_user_id')));

  const audit = await pool.query(
    `SELECT action, user_id, created_at FROM audit_logs
     WHERE table_name = 'violations' AND record_id = $1
     ORDER BY created_at, id`,
    [chainedViolation.id]
  );
  assert.deepEqual(audit.rows.map((item) => item.action), ['CREATE', 'COMPLETE', 'REOPEN', 'CLEAR', 'REOPEN', 'INVALID_CANCEL']);
  assert.ok(audit.rows.every((item) => item.user_id));
  assert.ok(audit.rows.every((item) => item.created_at));
});

test('violation lifecycle validates reasons, actions, transitions, existence, and RBAC', async () => {
  const users = Object.fromEntries(
    (await pool.query('SELECT id, username, role FROM users')).rows.map((user) => [user.username, user])
  );
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const adminToken = await tokenFor(users.admin_test);
  const studentToken = await tokenFor(users.student_test);
  const headToken = await tokenFor(users.head_test);
  const violation = await createViolation(adminToken, studentId);

  assert.equal((await act(adminToken, violation.id, 'CLEAR')).status, 400);
  assert.equal((await act(adminToken, violation.id, 'INVALID_CANCEL', '   ')).status, 400);
  assert.equal((await act(adminToken, violation.id, 'REOPEN', 'Reason')).status, 400);
  assert.equal((await act(adminToken, violation.id, 'UNKNOWN', 'Reason')).status, 400);
  assert.equal((await act(adminToken, 999999, 'COMPLETE')).status, 404);
  assert.equal((await act(studentToken, violation.id, 'COMPLETE')).status, 403);
  assert.equal((await act(headToken, violation.id, 'COMPLETE')).status, 403);
  assert.equal((await act(null, violation.id, 'COMPLETE')).status, 401);
  assert.equal((await act('invalid-token', violation.id, 'COMPLETE')).status, 401);

  assert.equal((await act(adminToken, violation.id, 'COMPLETE')).status, 200);
  assert.equal((await act(adminToken, violation.id, 'COMPLETE')).status, 400);
  assert.equal((await act(adminToken, violation.id, 'CLEAR', 'Not allowed')).status, 400);

  const selfRead = await request('/api/students/me/violations', { token: studentToken });
  assert.equal(selfRead.status, 200);
  assert.ok(selfRead.body.violations.some((item) => Number(item.id) === Number(violation.id)));

  const staffRead = await request(`/api/violations/${violation.id}`, { token: adminToken });
  assert.equal(staffRead.status, 200);
  assert.equal(staffRead.body.violation.status, 'COMPLETE');

  const directStatusUpdate = await request(`/api/violations/${violation.id}`, {
    token: adminToken,
    method: 'PUT',
    body: { status: 'OPEN' }
  });
  assert.equal(directStatusUpdate.status, 400);

  const deleteAttempt = await request(`/api/violations/${violation.id}`, {
    token: adminToken,
    method: 'DELETE'
  });
  assert.equal(deleteAttempt.status, 400);
});

test('service attendance completes assignment, violation, clearance, history, and audit atomically', async () => {
  const adminToken = await login('admin_test');
  const headToken = await login('head_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;

  await pool.query(
    `INSERT INTO student_clearance (student_id, academic_year, semester, status)
     VALUES ($1, '2026-2027', '1st Semester', 'PENDING')
     ON CONFLICT (student_id) DO UPDATE SET status = 'PENDING'`,
    [studentId]
  );

  const violationResult = await request('/api/violations', {
    token: adminToken,
    method: 'POST',
    body: {
      student_id: studentId,
      violation_type_id: 1,
      incident_date: '2026-08-27',
      description: 'Service completion workflow'
    }
  });
  assert.equal(violationResult.status, 201);
  const violation = violationResult.body.violation;
  const assignmentResponse = await assignService(adminToken, violation.id, studentId, 1);
  assert.equal(assignmentResponse.status, 201);
  const assignment = assignmentResponse.body.assignment;
  assert.equal(assignment.status, 'OPEN');

  const blockedClearance = await pool.query('SELECT status FROM student_clearance WHERE student_id = $1', [studentId]);
  assert.equal(blockedClearance.rows[0].status, 'NOT_ELIGIBLE');

  const spoofedTimeIn = await request('/api/qr/time-in', {
    token: headToken,
    method: 'POST',
    body: { qr_code: 'QR-TEST', department_id: 999, scanned_by: 999 }
  });
  assert.equal(spoofedTimeIn.status, 400);

  const timeIn = await request('/api/qr/time-in', {
    token: headToken,
    method: 'POST',
    body: { qr_code: 'QR-TEST' }
  });
  assert.equal(timeIn.status, 201);
  assert.equal(Number(timeIn.body.attendance.scanned_by), Number((await pool.query("SELECT id FROM users WHERE username = 'head_test'")).rows[0].id));
  assert.ok(timeIn.body.attendance.scanned_at);

  await pool.query(
    `UPDATE community_service_sessions SET time_in = time_in - INTERVAL '1 hour' WHERE id = $1`,
    [timeIn.body.session.id]
  );

  const timeOut = await request('/api/qr/time-out', {
    token: headToken,
    method: 'POST',
    body: { qr_code: 'QR-TEST', attendance_outcome: 'SERVICE_COMPLETED' }
  });
  assert.equal(timeOut.status, 201);
  assert.equal(timeOut.body.assignment.status, 'COMPLETED');
  assert.equal(Number(timeOut.body.assignment.completed_hours), 1);
  assert.equal(timeOut.body.violation.status, 'COMPLETE');
  assert.ok(timeOut.body.attendance.scanned_at);

  const eligibleClearance = await pool.query('SELECT status FROM student_clearance WHERE student_id = $1', [studentId]);
  assert.equal(eligibleClearance.rows[0].status, 'PENDING');

  const history = await pool.query('SELECT action, performed_by_role FROM violation_actions WHERE violation_id = $1 ORDER BY id', [violation.id]);
  assert.deepEqual(history.rows.map((row) => row.action), ['CREATE', 'COMPLETE']);
  assert.equal(history.rows[1].performed_by_role, 'DEPARTMENT_HEAD');

  const audit = await pool.query("SELECT action FROM audit_logs WHERE table_name = 'violations' AND record_id = $1 ORDER BY id", [violation.id]);
  assert.deepEqual(audit.rows.map((row) => row.action), ['CREATE', 'COMPLETE']);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_attendance WHERE assignment_id = $1', [assignment.id])).rows[0].count, 2);

  const futureTimeIn = await request('/api/qr/time-in', {
    token: headToken,
    method: 'POST',
    body: { qr_code: 'QR-TEST' }
  });
  assert.equal(futureTimeIn.status, 400);
});

test('CLEAR and INVALID_CANCEL preserve service history and REOPEN safely reactivates remaining work', async () => {
  const adminToken = await login('admin_test');
  const headToken = await login('head_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;

  const clearViolation = await createViolation(adminToken, studentId);
  await pool.query('UPDATE violations SET required_service_hours = 2 WHERE id = $1', [clearViolation.id]);
  assert.equal((await request('/api/community-service', {
    token: adminToken,
    method: 'POST',
    body: { violation_id: clearViolation.id, student_id: studentId, required_hours: 2, completed_hours: 99, status: 'COMPLETED' }
  })).status, 400);
  const clearAssignment = (await assignService(adminToken, clearViolation.id, studentId, 2)).body.assignment;

  const clearTimeIn = await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } });
  assert.equal(clearTimeIn.status, 201);
  await pool.query("UPDATE community_service_sessions SET time_in = time_in - INTERVAL '30 minutes' WHERE id = $1", [clearTimeIn.body.session.id]);
  const leftEarly = await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'LEFT_EARLY' } });
  assert.equal(leftEarly.status, 201);
  assert.equal(leftEarly.body.attendance_outcome, 'LEFT_EARLY');
  assert.equal(Number(leftEarly.body.assignment.completed_hours), 0.5);

  const cleared = await act(adminToken, clearViolation.id, 'CLEAR', 'Administrative closure');
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.assignment.status, 'ADMIN_CLOSED');
  assert.equal(Number(cleared.body.assignment.completed_hours), 0.5);
  assert.equal((await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })).status, 400);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_attendance WHERE assignment_id = $1', [clearAssignment.id])).rows[0].count, 2);

  const reopenedClear = await act(adminToken, clearViolation.id, 'REOPEN', 'Further service required');
  assert.equal(reopenedClear.body.violation.status, 'OPEN');
  assert.equal(reopenedClear.body.assignment.status, 'IN_PROGRESS');
  assert.equal(reopenedClear.body.clearanceSync.hasActiveViolation, true);
  await act(adminToken, clearViolation.id, 'INVALID_CANCEL', 'Close test record');

  const invalidViolation = await createViolation(adminToken, studentId);
  const invalidAssignment = (await assignService(adminToken, invalidViolation.id, studentId, 1)).body.assignment;
  const invalidated = await act(adminToken, invalidViolation.id, 'INVALID_CANCEL', 'Duplicate violation');
  assert.equal(invalidated.body.assignment.status, 'INVALID_CANCELLED');
  assert.equal(Number(invalidated.body.assignment.completed_hours), 0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_attendance WHERE assignment_id = $1', [invalidAssignment.id])).rows[0].count, 0);
  assert.equal((await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })).status, 400);

  const reopenedInvalid = await act(adminToken, invalidViolation.id, 'REOPEN', 'Record is valid');
  assert.equal(reopenedInvalid.body.assignment.status, 'OPEN');
  assert.equal(reopenedInvalid.body.clearanceSync.hasActiveViolation, true);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_assignments WHERE violation_id = $1', [invalidViolation.id])).rows[0].count, 1);
  await act(adminToken, invalidViolation.id, 'CLEAR', 'Close test record');
});

test('clearance eligibility evaluates all violations for the student', async () => {
  const adminToken = await login('admin_test');
  const studentToken = await login('student_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;

  const openOne = await createViolation(adminToken, studentId);
  const completeOne = await createViolation(adminToken, studentId);
  await act(adminToken, completeOne.id, 'COMPLETE');
  assert.equal((await act(adminToken, completeOne.id, 'REOPEN', 'Recheck')).body.clearanceSync.hasActiveViolation, true);
  await act(adminToken, completeOne.id, 'CLEAR', 'Resolved');

  let eligibility = await request(`/api/clearance/student/${studentId}/eligibility`, { token: adminToken });
  assert.equal(eligibility.body.eligible, false);

  await act(adminToken, openOne.id, 'COMPLETE');
  eligibility = await request(`/api/clearance/student/${studentId}/eligibility`, { token: adminToken });
  assert.equal(eligibility.body.eligible, true);

  const clearOne = await createViolation(adminToken, studentId);
  await act(adminToken, clearOne.id, 'CLEAR', 'Administrative close');
  const invalidOne = await createViolation(adminToken, studentId);
  await act(adminToken, invalidOne.id, 'INVALID_CANCEL', 'Invalid record');
  eligibility = await request(`/api/clearance/student/${studentId}/eligibility`, { token: adminToken });
  assert.equal(eligibility.body.eligible, true);

  const reopened = await act(adminToken, clearOne.id, 'REOPEN', 'New review');
  assert.equal(reopened.body.clearanceSync.hasActiveViolation, true);
  eligibility = await request(`/api/clearance/student/${studentId}/eligibility`, { token: adminToken });
  assert.equal(eligibility.body.eligible, false);

  const selfEligibility = await request('/api/student/clearance/eligibility', { token: studentToken });
  assert.equal(selfEligibility.status, 200);
  assert.equal(selfEligibility.body.eligible, false);
  const selfClearance = await request('/api/student/clearance', { token: studentToken });
  assert.equal(selfClearance.status, 200);
  assert.ok(selfClearance.body.clearanceRecords.every((record) => !Object.hasOwn(record, 'cleared_by')));
  await act(adminToken, clearOne.id, 'INVALID_CANCEL', 'Close test record');
});

test('multi-write failures roll back assignment, audit, history, and clearance changes', async () => {
  const adminToken = await login('admin_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;

  await pool.query(`CREATE FUNCTION fail_test_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced assignment failure'; END $$`);
  await pool.query(`CREATE TRIGGER fail_test_assignment_trigger BEFORE INSERT ON community_service_assignments FOR EACH ROW EXECUTE FUNCTION fail_test_assignment()`);
  const assignmentFailureViolation = await createViolation(adminToken, studentId);
  const failedCreate = await assignService(adminToken, assignmentFailureViolation.id, studentId, 1);
  assert.equal(failedCreate.status, 500);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_assignments WHERE violation_id = $1', [assignmentFailureViolation.id])).rows[0].count, 0);
  await pool.query('DROP TRIGGER fail_test_assignment_trigger ON community_service_assignments');
  await pool.query('DROP FUNCTION fail_test_assignment()');

  const auditFailureViolation = await createViolation(adminToken, studentId);
  await pool.query(`CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CLEAR' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER fail_test_audit_trigger BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_test_audit()`);
  assert.equal((await act(adminToken, auditFailureViolation.id, 'CLEAR', 'Must rollback')).status, 500);
  assert.equal((await pool.query('SELECT status FROM violations WHERE id = $1', [auditFailureViolation.id])).rows[0].status, 'OPEN');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM violation_actions WHERE violation_id = $1 AND action = 'CLEAR'", [auditFailureViolation.id])).rows[0].count, 0);
  await pool.query('DROP TRIGGER fail_test_audit_trigger ON audit_logs');
  await pool.query('DROP FUNCTION fail_test_audit()');
  await act(adminToken, auditFailureViolation.id, 'INVALID_CANCEL', 'Close test record');

  const clearanceFailureViolation = await createViolation(adminToken, studentId);
  await pool.query(
    `INSERT INTO student_clearance (student_id, academic_year, semester, status)
     VALUES ($1, '2026-2027', '1st Semester', 'NOT_ELIGIBLE')`,
    [studentId]
  );
  await pool.query(`CREATE FUNCTION fail_test_clearance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced clearance failure'; END $$`);
  await pool.query(`CREATE TRIGGER fail_test_clearance_trigger BEFORE UPDATE ON student_clearance FOR EACH ROW EXECUTE FUNCTION fail_test_clearance()`);
  assert.equal((await act(adminToken, clearanceFailureViolation.id, 'COMPLETE')).status, 500);
  assert.equal((await pool.query('SELECT status FROM violations WHERE id = $1', [clearanceFailureViolation.id])).rows[0].status, 'OPEN');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE table_name = 'violations' AND record_id = $1 AND action = 'COMPLETE'", [clearanceFailureViolation.id])).rows[0].count, 0);
  await pool.query('DROP TRIGGER fail_test_clearance_trigger ON student_clearance');
  await pool.query('DROP FUNCTION fail_test_clearance()');
  await act(adminToken, clearanceFailureViolation.id, 'INVALID_CANCEL', 'Close test record');
});

test('QR resolves assignment departments, prioritizes active sessions and protects Time Out previews',async()=>{
  const admin=await login('admin_test'),head=await login('head_test'),student=await login('student_test');
  const studentId=(await pool.query('SELECT id FROM students LIMIT 1')).rows[0].id;
  const first=await createServiceViolation(admin,studentId,10);
  const sole=await request('/api/qr/scan',{token:head,method:'POST',body:{qr_code:'QR-TEST'}});
  assert.equal(sole.body.assignment.id,first.assignment.id);
  assert.equal(sole.body.assignment.department_name,'Test Department');assert.ok(sole.body.server_time);assert.equal(sole.body.allowance.daily_remaining_minutes,480);
  const second=await createServiceViolation(admin,studentId,10);
  const multiple=await request('/api/qr/scan',{token:head,method:'POST',body:{qr_code:'QR-TEST'}});
  assert.equal(multiple.body.assignment,null);assert.equal(multiple.body.assignments.length,2);
  const opened=await request('/api/qr/time-in',{token:head,method:'POST',body:{qr_code:'QR-TEST',assignment_id:first.assignment.id,session_type:'FIXED',selected_duration_minutes:120}});
  assert.equal(opened.status,201,JSON.stringify(opened.body));
  const rescan=await request('/api/qr/scan',{token:head,method:'POST',body:{qr_code:'QR-TEST',assignment_id:second.assignment.id}});
  assert.equal(rescan.body.assignment.id,first.assignment.id);assert.equal(rescan.body.active_session.id,opened.body.session.id);
  const preview=await request(`/api/community-service/sessions/${opened.body.session.id}/time-out-preview`,{token:head});
  assert.equal(preview.status,200);assert.equal(preview.body.preview.completionReason,'EARLY_TIME_OUT');assert.equal(preview.body.available_officers.length,1);
  assert.equal((await request(`/api/community-service/sessions/${opened.body.session.id}/time-out-preview`,{token:student})).status,403);
  assert.equal((await request(`/api/community-service/sessions/${opened.body.session.id}/time-out-preview`)).status,401);
  const myDtr=await request('/api/students/me/community-service/dtr',{token:student});
  assert.equal(myDtr.body.total_sessions,1);assert.equal(myDtr.body.sessions[0].session_type,'FIXED');assert.ok(myDtr.body.sessions[0].server_time);
  const department=(await pool.query("INSERT INTO departments(department_code,department_name) VALUES('OTHER','Restricted department') RETURNING id")).rows[0].id;
  assert.equal((await request('/api/community-service/attendance/time-in',{token:admin,method:'POST',body:{assignment_id:second.assignment.id,student_id:studentId,department_id:department,session_type:'FIXED',selected_duration_minutes:120}})).status,403);
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=FALSE');
  assert.equal((await request(`/api/community-service/sessions/${opened.body.session.id}/time-out-preview`,{token:head})).status,403);
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=TRUE');
  await pool.query('UPDATE community_service_sessions SET department_id=$1 WHERE id=$2',[department,opened.body.session.id]);
  const restricted=await request('/api/qr/scan',{token:head,method:'POST',body:{qr_code:'QR-TEST'}});
  assert.equal(restricted.body.active_session_elsewhere,true);assert.equal(restricted.body.active_session,null);
  assert.equal((await request('/api/qr/time-in',{token:head,method:'POST',body:{qr_code:'QR-TEST',assignment_id:second.assignment.id,session_type:'FIXED',selected_duration_minutes:120}})).status,409);
  assert.equal((await request(`/api/community-service/sessions/${opened.body.session.id}/time-out-preview`,{token:head})).status,403);
});

test('parallel TIME_IN and TIME_OUT requests preserve one session and one credit', async () => {
  const adminToken = await login('admin_test');
  const headToken = await login('head_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const { assignment } = await createServiceViolation(adminToken, studentId, 1);

  const timeIns = await Promise.all([
    request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } }),
    request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })
  ]);
  assert.deepEqual(timeIns.map((item) => item.status).sort(), [201, 409]);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_sessions WHERE assignment_id = $1 AND time_out IS NULL', [assignment.id])).rows[0].count, 1);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE table_name = 'community_service_sessions' AND action = 'TIME_IN'", [])).rows[0].count, 1);

  await pool.query("UPDATE community_service_sessions SET time_in = time_in - INTERVAL '1 hour' WHERE assignment_id = $1", [assignment.id]);
  const timeOuts = await Promise.all([
    request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'SERVICE_COMPLETED' } }),
    request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'SERVICE_COMPLETED' } })
  ]);
  assert.equal(timeOuts.filter((item) => item.status === 201).length, 1);
  assert.equal(timeOuts.filter((item) => item.status !== 201).length, 1);
  assert.equal(timeOuts.find((item) => item.status !== 201).status, 200);
  assert.equal(timeOuts[0].body.session.id, timeOuts[1].body.session.id);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_progress_history WHERE assignment_id = $1', [assignment.id])).rows[0].count, 1);
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id = $1', [assignment.id])).rows[0].completed_hours), 1);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE table_name = 'community_service_sessions' AND action = 'TIME_OUT_CREDITED'", [])).rows[0].count, 1);
});

test('DTR reports preserve actual work and capped credit with secure filters', async () => {
  const adminToken = await login('admin_test');
  const headToken = await login('head_test');
  const studentToken = await login('student_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const studentUserId = (await pool.query("SELECT id FROM users WHERE username = 'student_test'")).rows[0].id;
  await pool.query("INSERT INTO notifications (user_id, title, message, notification_type) VALUES ($1, 'Service update', 'Attendance is ready', 'SERVICE')", [studentUserId]);
  const notifications = await request('/api/students/me/notifications', { token: studentToken });
  assert.equal(notifications.status, 200);
  assert.equal(notifications.body.notifications.length, 1);
  assert.equal(notifications.body.notifications[0].title, 'Service update');
  assert.equal((await request('/api/students/me/notifications?user_id=1', { token: studentToken })).status, 400);
  const departmentId = (await pool.query("SELECT id FROM departments WHERE department_code = 'TEST'")).rows[0].id;
  const { assignment } = await createServiceViolation(adminToken, studentId, 2);

  for (const [index, minutes] of [60, 45, 30].entries()) {
    const timeIn = await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } });
    assert.equal(timeIn.status, 201);
    await pool.query('UPDATE community_service_sessions SET time_in = time_in - ($1 * INTERVAL \'1 minute\') WHERE id = $2', [minutes, timeIn.body.session.id]);
    const timeOut = await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: index === 2 ? 'SERVICE_COMPLETED' : 'TODAYS_SERVICE_COMPLETED' } });
    assert.equal(timeOut.status, 201);
  }

  const report = await request(`/api/reports/dtr?assignment_id=${assignment.id}&department_id=${departmentId}`, { token: adminToken });
  assert.equal(report.status, 200);
  assert.equal(report.body.totals.completed_sessions, 3);
  assert.equal(report.body.totals.worked_minutes, 135);
  assert.equal(report.body.totals.credited_minutes, 120);
  assert.equal(Number(report.body.data[0].remaining_hours), 0);

  const self = await request('/api/students/me/community-service/dtr', { token: studentToken });
  assert.equal(self.status, 200);
  assert.equal(self.body.sessions.length, 3);
  assert.equal(self.body.assignments[0].required_minutes, 120);
  assert.equal(self.body.assignments[0].credited_minutes, 120);
  assert.equal(self.body.assignments[0].remaining_minutes, 0);
  assert.equal((await request(`/api/students/me/community-service/dtr?student_id=${studentId + 1}`, { token: studentToken })).status, 400);

  assert.equal((await request('/api/reports/dtr?from=not-a-date', { token: adminToken })).status, 400);
  assert.equal((await request('/api/reports/dtr?from=2026-09-02&to=2026-09-01', { token: adminToken })).status, 400);
  assert.equal((await request(`/api/reports/dtr?department_id=${departmentId + 100}`, { token: headToken })).status, 403);
  assert.equal((await request(`/api/reports/dtr?department_id=${departmentId}`, { token: headToken })).status, 200);
  assert.equal((await request(`/api/reports/dtr?department_id=${departmentId}`, { token: studentToken })).status, 403);
  assert.equal((await request('/api/reports/non-compliance?sort_by=hours', { token: headToken })).status, 200);
  assert.equal((await request('/api/reports/non-compliance?department_id=999', { token: headToken })).status, 400);
  assert.equal((await request('/api/reports/non-compliance', { token: studentToken })).status, 403);

  const sessionDates = (await pool.query(
    `SELECT TO_CHAR(MIN(time_in) AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS first_date,
            TO_CHAR(MAX(time_in) AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS last_date
     FROM community_service_sessions WHERE assignment_id = $1`, [assignment.id]
  )).rows[0];
  assert.equal((await request(`/api/reports/dtr?from=${sessionDates.first_date}&to=${sessionDates.last_date}`, { token: adminToken })).body.totals.completed_sessions, 3);
  assert.equal((await request('/api/reports/dtr?from=2000-01-01&to=2000-01-02', { token: adminToken })).body.totals.completed_sessions, 0);
});

test('TIME_OUT rolls session, progress, assignment, and audit back together', async () => {
  const adminToken = await login('admin_test');
  const headToken = await login('head_test');
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const { assignment } = await createServiceViolation(adminToken, studentId, 1);
  const timeIn = await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } });
  await pool.query("UPDATE community_service_sessions SET time_in = time_in - INTERVAL '30 minutes' WHERE id = $1", [timeIn.body.session.id]);
  await pool.query(`CREATE FUNCTION fail_test_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced progress failure'; END $$`);
  await pool.query(`CREATE TRIGGER fail_test_progress_trigger BEFORE INSERT ON community_service_progress_history FOR EACH ROW EXECUTE FUNCTION fail_test_progress()`);
  assert.equal((await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST', attendance_outcome: 'TODAYS_SERVICE_COMPLETED' } })).status, 500);
  assert.equal((await pool.query('SELECT status FROM community_service_sessions WHERE id = $1', [timeIn.body.session.id])).rows[0].status, 'ACTIVE');
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id = $1', [assignment.id])).rows[0].completed_hours), 0);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM community_service_attendance WHERE assignment_id = $1 AND attendance_type = 'TIME_OUT'", [assignment.id])).rows[0].count, 0);
  await pool.query('DROP TRIGGER fail_test_progress_trigger ON community_service_progress_history');
  await pool.query('DROP FUNCTION fail_test_progress()');
});
