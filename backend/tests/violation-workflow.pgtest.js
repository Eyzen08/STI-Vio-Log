const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { listMigrationFiles } = require('../scripts/migrate');

require('dotenv').config({ quiet: true });

const schemaName = `sti_vio_log_test_${process.pid}_${Date.now()}`.toLowerCase();

if (!/^sti_vio_log_test_[a-z0-9_]+$/.test(schemaName)) {
  throw new Error('Refusing to use an unguarded PostgreSQL test schema');
}

process.env.DB_SCHEMA = schemaName;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'this-is-a-secure-test-secret-123456';

const adminPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

let app;
let pool;
let server;
let baseUrl;

const migrationsDirectory = path.resolve(__dirname, '../../database/migrations');
const migrationFiles = listMigrationFiles(migrationsDirectory).map((name) => path.join(migrationsDirectory, name));

async function request(route, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  return { status: response.status, body: await response.json() };
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, session_version: Number(user.session_version || 1) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
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
      ('admin_test', $1, 'ADMIN'),
      ('discipline_test', $1, 'DISCIPLINE_OFFICE'),
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
  const response = await request('/api/login', {
    method: 'POST',
    body: { username, password: 'test-password' }
  });
  assert.equal(response.status, 200);
  return response.body.token;
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

test('violation lifecycle transitions preserve structured history and audit records', async () => {
  const users = Object.fromEntries(
    (await pool.query('SELECT id, username, role FROM users')).rows.map((user) => [user.username, user])
  );
  const studentId = (await pool.query("SELECT id FROM students WHERE student_number = '02000123456'")).rows[0].id;
  const adminToken = tokenFor(users.admin_test);
  const disciplineToken = tokenFor(users.discipline_test);

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

  const studentToken = tokenFor(users.student_test);
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
  const adminToken = tokenFor(users.admin_test);
  const studentToken = tokenFor(users.student_test);
  const headToken = tokenFor(users.head_test);
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
    body: { qr_code: 'QR-TEST' }
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
  assert.equal((await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })).status, 201);

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
    request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } }),
    request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })
  ]);
  assert.equal(timeOuts.filter((item) => item.status === 201).length, 1);
  assert.equal(timeOuts.filter((item) => item.status !== 201).length, 1);
  assert.ok(timeOuts.find((item) => item.status !== 201).status === 409 || timeOuts.find((item) => item.status !== 201).status === 400);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM community_service_progress_history WHERE assignment_id = $1', [assignment.id])).rows[0].count, 1);
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id = $1', [assignment.id])).rows[0].completed_hours), 1);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE table_name = 'community_service_sessions' AND action = 'TIME_OUT'", [])).rows[0].count, 1);
});

test('DTR reports return exact worked and capped credited minutes with secure filters', async () => {
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

  for (const minutes of [60, 45, 30]) {
    const timeIn = await request('/api/qr/time-in', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } });
    assert.equal(timeIn.status, 201);
    await pool.query('UPDATE community_service_sessions SET time_in = time_in - ($1 * INTERVAL \'1 minute\') WHERE id = $2', [minutes, timeIn.body.session.id]);
    const timeOut = await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } });
    assert.equal(timeOut.status, 201);
  }

  const report = await request(`/api/reports/dtr?assignment_id=${assignment.id}&department_id=${departmentId}`, { token: adminToken });
  assert.equal(report.status, 200);
  assert.equal(report.body.totals.completed_sessions, 3);
  assert.equal(report.body.totals.worked_minutes, 135);
  assert.equal(report.body.totals.credited_minutes, 120);
  assert.equal(report.body.data[0].remaining_hours, '0.00');

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
    `SELECT TO_CHAR(MIN(time_in) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_date,
            TO_CHAR(MAX(time_in) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_date
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
  assert.equal((await request('/api/qr/time-out', { token: headToken, method: 'POST', body: { qr_code: 'QR-TEST' } })).status, 500);
  assert.equal((await pool.query('SELECT status FROM community_service_sessions WHERE id = $1', [timeIn.body.session.id])).rows[0].status, 'ACTIVE');
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id = $1', [assignment.id])).rows[0].completed_hours), 0);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM community_service_attendance WHERE assignment_id = $1 AND attendance_type = 'TIME_OUT'", [assignment.id])).rows[0].count, 0);
  await pool.query('DROP TRIGGER fail_test_progress_trigger ON community_service_progress_history');
  await pool.query('DROP FUNCTION fail_test_progress()');
});
