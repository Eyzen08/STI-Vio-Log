const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { testDatabaseConfig } = require('./testDatabase');
const { listMigrationFiles } = require('../scripts/migrate');
const { notifyAttendanceStaff } = require('../src/services/notificationService');
require('dotenv').config({ quiet: true });

test('office attendance history is deduplicated, private and independent per recipient', async () => {
  const schema = `sti_vio_log_test_office_notifications_${process.pid}_${Date.now()}`;
  const admin = new Pool(testDatabaseConfig());
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool(testDatabaseConfig(schema));
    const directory = path.resolve(__dirname, '../../database/migrations');
    for (const file of listMigrationFiles(directory).filter(file => file < '049')) {
      await pool.query(fs.readFileSync(path.join(directory, file), 'utf8'));
    }
    await pool.query(`INSERT INTO users(username,password_hash,role,is_active) VALUES
      ('admin','hash','DISCIPLINE_ADMIN',TRUE),('officer','hash','DISCIPLINE_OFFICE',TRUE),
      ('inactive_officer','hash','DISCIPLINE_OFFICE',TRUE),('head','hash','DEPARTMENT_HEAD',TRUE),
      ('student','hash','STUDENT',TRUE),('second_officer','hash','DISCIPLINE_OFFICE',TRUE);
      UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP,deactivated_by=1 WHERE id=3;
      INSERT INTO departments(department_code,department_name) VALUES('TEST','Library');
      INSERT INTO students(user_id,student_number,first_name,last_name,qr_code) VALUES(5,'TEST-1','Test','Student','TEST-QR');
      INSERT INTO notifications(user_id,title,message,notification_type,event_key,category,severity,resource_type,resource_id,link_path,metadata,is_read,read_at,created_at) VALUES
      (1,'Time in','Original attendance','ATTENDANCE_TIME_IN','attendance:9:time_in:event:1','ATTENDANCE','WARNING','community_service_sessions',9,'/admin/community-service?assignment_id=8&session_id=9','{"assignment_id":8}',TRUE,'2026-10-09T02:00:00Z','2026-10-09T01:00:00Z'),
      (2,'Time in','Original attendance','ATTENDANCE_TIME_IN','attendance:9:time_in:event:2','ATTENDANCE','WARNING','community_service_sessions',9,'/admin/community-service?assignment_id=8&session_id=9','{"assignment_id":8}',FALSE,NULL,'2026-10-09T01:00:00Z'),
      (2,'Time out','Officer-only event','ATTENDANCE_TIME_OUT','attendance:9:time_out:event:2','ATTENDANCE','INFO','community_service_sessions',9,'/admin/community-service?assignment_id=8&session_id=9','{"assignment_id":8}',FALSE,NULL,'2026-10-09T03:00:00Z'),
      (1,'Security','Private security',NULL,'security:1','SECURITY','WARNING',NULL,NULL,NULL,'{}',FALSE,NULL,CURRENT_TIMESTAMP),
      (1,'Message','Private message',NULL,'message:1','MESSAGES','INFO',NULL,NULL,NULL,'{}',FALSE,NULL,CURRENT_TIMESTAMP),
      (5,'Student','Private student attendance',NULL,'attendance:10:time_in:event:5','ATTENDANCE','INFO',NULL,NULL,NULL,'{}',FALSE,NULL,CURRENT_TIMESTAMP),
      (4,'Head','Department attendance',NULL,'attendance:11:time_in:event:4','ATTENDANCE','INFO',NULL,NULL,NULL,'{}',FALSE,NULL,CURRENT_TIMESTAMP),
      (1,'Legacy','Unidentified legacy attendance',NULL,NULL,'ATTENDANCE','INFO',NULL,NULL,NULL,'{}',FALSE,NULL,CURRENT_TIMESTAMP);`);
    const before = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
    const migration = fs.readFileSync(path.join(directory, '049_office_attendance_notifications.sql'), 'utf8');
    await pool.query(migration);
    const after = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
    assert.deepEqual(after.slice(0, before.length), before);
    const copies = after.slice(before.length);
    assert.equal(copies.length, 3);
    for (const copy of copies) {
      const source = before.find(row => row.event_key?.replace(/:\d+$/, '') === copy.event_key.replace(/:\d+$/, ''));
      for (const field of ['title','message','notification_type','category','severity','resource_type','resource_id','link_path','metadata','created_at']) {
        assert.deepEqual(copy[field], source[field], field);
      }
      assert.equal(copy.is_read, false);
      assert.equal(copy.read_at, null);
      assert.equal(copy.acknowledged_at, null);
      assert.ok([1, 2, 6].includes(Number(copy.user_id)));
    }
    await pool.query(migration);
    assert.deepEqual((await pool.query('SELECT * FROM notifications ORDER BY id')).rows, after);
    await pool.query("UPDATE notifications SET is_read=TRUE,read_at=CURRENT_TIMESTAMP WHERE event_key='attendance:9:time_in:event:6'");
    assert.equal((await pool.query("SELECT is_read FROM notifications WHERE event_key='attendance:9:time_in:event:2'")).rows[0].is_read, false);

    const event = { studentId: 1, departmentId: 1, sessionId: 12, assignmentId: 8, action: 'TIME_IN' };
    const created = await notifyAttendanceStaff(pool, event);
    assert.deepEqual(created.map(row => row.user_id).sort(), [1, 2, 6]);
    assert.deepEqual(await notifyAttendanceStaff(pool, event), []);
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
