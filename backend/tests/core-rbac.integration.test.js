const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'this-is-a-secure-test-secret-123456';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'test';
process.env.DB_USER = process.env.DB_USER || 'test';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';

const pool = require('../src/config/database');
const app = require('../src/server');

const accounts = {
  1: { id: 1, username: 'admin', role: 'ADMIN', department_id: null },
  2: { id: 2, username: 'discipline', role: 'DISCIPLINE_OFFICE', department_id: null },
  3: { id: 3, username: 'head', role: 'DEPARTMENT_HEAD', department_id: 9 },
  4: { id: 4, username: 'student', role: 'STUDENT', department_id: null }
};

function tokenFor(id, options = {}) {
  return jwt.sign(
    { id, username: accounts[id]?.username || 'unknown', role: options.claimedRole || accounts[id]?.role },
    process.env.JWT_SECRET,
    { expiresIn: options.expiresIn || '1h' }
  );
}

function mockResult(sql, params = []) {
  const text = String(sql).replace(/\s+/g, ' ').trim();

  if (text.includes('FROM users u') && text.includes('LEFT JOIN department_heads')) {
    const account = accounts[Number(params[0])];
    return { rows: account ? [account] : [] };
  }

  if (text.includes('FROM departments') && text.includes('is_active = TRUE')) {
    return { rows: Number(params[0]) === 9 ? [{ id: 9 }] : [] };
  }

  if (text.includes('FROM students') && text.includes('WHERE user_id = $1')) {
    return { rows: [{ id: 40, student_number: '02000123456', first_name: 'Test', last_name: 'Student', email: 'student@example.test', program: 'BSIT', section: 'A', year_level: 2, qr_code: 'QR-40' }] };
  }

  if (text.includes('FROM notifications') && text.includes('WHERE user_id = $1')) {
    return { rows: [{ id: 120, title: 'Service update', message: 'Attendance recorded', notification_type: 'SERVICE', is_read: false, created_at: new Date() }] };
  }

  if (text.includes('FROM violations v') && text.includes('WHERE v.student_id = $1')) {
    return { rows: [{ id: 70, student_id: 40, status: 'OPEN', required_service_hours: 2, completed_service_hours: 0, remaining_service_hours: 2 }] };
  }

  if (text.includes('FROM community_service_assignments cs') && text.includes('WHERE s.user_id = $1')) {
    return { rows: [{ id: 80, student_id: 40, required_hours: 2, completed_hours: 0, remaining_hours: 2, status: 'OPEN' }] };
  }

  if (text.includes('FROM student_clearance sc') && text.includes('WHERE sc.student_id = $1')) {
    return { rows: [{ id: 90, student_id: 40, status: 'NOT_ELIGIBLE' }] };
  }

  if (text === 'SELECT * FROM violations ORDER BY id DESC') {
    return { rows: [] };
  }

  if (text.includes('FROM community_service_assignments cs') && !text.includes('WHERE')) {
    return { rows: [] };
  }

  if (text.includes('FROM student_clearance sc') && !text.includes('WHERE')) {
    return { rows: [] };
  }

  if (text.includes('FROM students') && text.includes('WHERE qr_code = $1')) {
    return { rows: [{ id: 40, student_number: '02000123456', first_name: 'Test', last_name: 'Student', qr_code: 'QR-40' }] };
  }

  if (text.includes('community_service_assignments') && text.includes("status IN ('OPEN', 'IN_PROGRESS')")) {
    return { rows: [{ id: 80, violation_id: 70, student_id: 40, required_hours: 2, completed_hours: 0, remaining_hours: 2, status: 'OPEN' }] };
  }

  if (text.includes('SELECT COUNT(*) AS count') && text.includes('FROM violations')) {
    return { rows: [{ count: '1' }] };
  }

  if (text.includes('SELECT COUNT(*) AS count') && text.includes('FROM community_service_assignments')) {
    return { rows: [{ count: '0' }] };
  }

  if (text.includes('FROM student_clearance') && text.includes('ORDER BY id')) {
    return { rows: [] };
  }

  if (text.includes('FROM students') && text.includes('ORDER BY last_name')) {
    return { rows: [] };
  }

  return { rows: [] };
}

async function request(baseUrl, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  return { status: response.status, body: await response.json() };
}

test('mounted API enforces core role and ownership boundaries', async (t) => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let capturedAttendanceParams = null;
  let capturedViolationParams = null;

  pool.query = async (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    if (text.includes('INSERT INTO community_service_attendance')) {
      capturedAttendanceParams = params;
      return { rows: [{ id: 100, scanned_by: params[3], department_id: params[2] }] };
    }
    if (text.includes('INSERT INTO qr_scan_logs')) {
      return { rows: [{ id: 101 }] };
    }
    return mockResult(sql, params);
  };

  pool.connect = async () => ({
    query: async (sql, params) => {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('INSERT INTO violations')) {
        capturedViolationParams = params;
        return { rows: [{ id: 70, student_id: params[0], status: params[5], required_service_hours: params[6], completed_service_hours: params[7] }] };
      }
      if (text.includes('FROM community_service_assignments a') && text.includes('JOIN violations v')) {
        return { rows: [{ id: 80, violation_id: 70, student_id: 40, required_hours: 2, completed_hours: 0, remaining_hours: 2, status: 'OPEN', violation_status: 'OPEN' }] };
      }
      if (text.includes('FROM community_service_sessions')) return { rows: [] };
      if (text.includes('INSERT INTO community_service_attendance')) {
        capturedAttendanceParams = params;
        return { rows: [{ id: 100, assignment_id: 80, scanned_by: params[3], department_id: params[2], scanned_at: new Date() }] };
      }
      if (text.includes('INSERT INTO community_service_sessions')) return { rows: [{ id: 110, assignment_id: 80, status: 'ACTIVE', worked_minutes: null }] };
      if (text.includes('INSERT INTO qr_scan_logs')) return { rows: [{ id: 101 }] };
      if (text.includes('INSERT INTO audit_logs')) return { rows: [] };
      return mockResult(sql, params);
    },
    release() {}
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await new Promise((resolve) => server.close(resolve));
  });

  assert.equal((await request(baseUrl, '/api/students')).status, 401);
  assert.equal((await request(baseUrl, '/api/students', { token: 'invalid-token' })).status, 401);

  const expired = tokenFor(4, { expiresIn: '-1s' });
  assert.equal((await request(baseUrl, '/api/students/me', { token: expired })).status, 401);

  const admin = tokenFor(1);
  const discipline = tokenFor(2);
  const head = tokenFor(3);
  const student = tokenFor(4, { claimedRole: 'ADMIN' });

  assert.equal((await request(baseUrl, '/api/students', { token: admin })).status, 200);
  assert.equal((await request(baseUrl, '/api/violations', { token: discipline })).status, 200);
  assert.equal((await request(baseUrl, '/api/violations', {
    token: discipline,
    method: 'POST',
    body: { student_id: 40, violation_type_id: 1, incident_date: '2026-08-27', required_service_hours: 0, reported_by: 999, status: 'CLEARED', completed_service_hours: 99 }
  })).status, 400);
  assert.equal((await request(baseUrl, '/api/violations', {
    token: discipline,
    method: 'POST',
    body: { student_id: 40, violation_type_id: 1, incident_date: '2026-08-27', required_service_hours: 0 }
  })).status, 201);
  assert.equal(capturedViolationParams[2], 2);
  assert.equal(capturedViolationParams[5], 'OPEN');
  assert.equal(capturedViolationParams[7], 0);
  assert.equal((await request(baseUrl, '/api/community-service', { token: discipline })).status, 200);
  assert.equal((await request(baseUrl, '/api/clearance', { token: discipline })).status, 200);

  assert.equal((await request(baseUrl, '/api/qr/scan', { token: head, method: 'POST', body: { qr_code: 'QR-40', department_id: 999, scanned_by: 999 } })).status, 400);
  assert.equal((await request(baseUrl, '/api/qr/time-in', { token: head, method: 'POST', body: { qr_code: 'QR-40' } })).status, 201);
  assert.equal(capturedAttendanceParams[2], 9);
  assert.equal(capturedAttendanceParams[3], 3);
  assert.equal((await request(baseUrl, '/api/violations', { token: head, method: 'POST', body: {} })).status, 403);
  assert.equal((await request(baseUrl, '/api/students', { token: head })).status, 403);
  assert.equal((await request(baseUrl, '/api/community-service', { token: head })).status, 200);
  assert.equal((await request(baseUrl, '/api/community-service/80', { token: head })).status, 404);
  assert.equal((await request(baseUrl, '/api/reports/non-compliance', { token: head })).status, 200);
  assert.equal((await request(baseUrl, '/api/reports/non-compliance?department_id=999', { token: head })).status, 400);
  assert.equal((await request(baseUrl, '/api/community-service', { token: head, method: 'POST', body: {} })).status, 403);

  assert.equal((await request(baseUrl, '/api/students/me', { token: student })).status, 200);
  assert.equal((await request(baseUrl, '/api/students/me/violations', { token: student })).status, 200);
  assert.equal((await request(baseUrl, '/api/students/me/violations?student_id=41', { token: student })).status, 400);
  assert.equal((await request(baseUrl, '/api/students/me/community-service', { token: student })).status, 200);
  const notifications = await request(baseUrl, '/api/students/me/notifications', { token: student });
  assert.equal(notifications.status, 200);
  assert.equal(notifications.body.notifications.length, 1);
  assert.equal((await request(baseUrl, '/api/students/me/notifications?student_id=41', { token: student })).status, 400);
  const selfClearance = await request(baseUrl, '/api/students/me/clearance', { token: student });
  assert.equal(selfClearance.status, 200);
  assert.ok(selfClearance.body.clearanceRecords.every((record) => !Object.hasOwn(record, 'cleared_by')));
  assert.equal((await request(baseUrl, '/api/students/me/clearance?student_id=41', { token: student })).status, 400);
  assert.equal((await request(baseUrl, '/api/student/clearance/eligibility?student_id=41', { token: student })).status, 400);
  assert.equal((await request(baseUrl, '/api/students/41', { token: student })).status, 403);
  assert.equal((await request(baseUrl, '/api/violations', { token: student, method: 'POST', body: { student_id: 41 } })).status, 403);
  assert.equal((await request(baseUrl, '/api/community-service/80', { token: student, method: 'PUT', body: { completed_hours: 2 } })).status, 403);
  assert.equal((await request(baseUrl, '/api/qr/time-in', { token: student, method: 'POST', body: { qr_code: 'QR-40', department_id: 9 } })).status, 403);
  assert.equal((await request(baseUrl, '/api/reports/violations', { token: student })).status, 403);
  assert.equal((await request(baseUrl, '/api/clearance/90', { token: student, method: 'PUT', body: { status: 'CLEARED' } })).status, 403);
  assert.equal((await request(baseUrl, '/api/audit-logs', { token: student })).status, 403);
});
