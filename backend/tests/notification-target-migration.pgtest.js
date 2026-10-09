const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { testDatabaseConfig } = require('./testDatabase');
const { listMigrationFiles } = require('../scripts/migrate');
require('dotenv').config({ quiet: true });

test('notification upgrade recovers structured targets and preserves notification history', async () => {
  const schema = `sti_vio_log_test_notification_${process.pid}_${Date.now()}`;
  const admin = new Pool(testDatabaseConfig());
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool(testDatabaseConfig(schema));
    const directory = path.resolve(__dirname, '../../database/migrations');
    for (const file of listMigrationFiles(directory).filter((file) => file < '047')) await pool.query(fs.readFileSync(path.join(directory, file), 'utf8'));
    await pool.query(`INSERT INTO users(username,password_hash,role) VALUES('notify_admin','hash','DISCIPLINE_ADMIN'),('notify_head','hash','DEPARTMENT_HEAD'),('notify_student','hash','STUDENT');
      INSERT INTO departments(department_code,department_name) VALUES('NOTIFY','Notification test');
      INSERT INTO department_heads(user_id,department_id,first_name,last_name) VALUES(2,1,'Test','Officer');
      INSERT INTO students(user_id,student_number,first_name,last_name,qr_code) VALUES(3,'NOTIFY-1','Test','Student','NOTIFY-QR');
      INSERT INTO violations(student_id,violation_type_id,incident_date,description,required_service_hours) VALUES(1,1,CURRENT_DATE,'Notification test',20);
      INSERT INTO community_service_assignments(violation_id,student_id,department_id,department_head_id,required_hours,remaining_hours) VALUES(1,1,1,1,20,20);
      INSERT INTO community_service_sessions(assignment_id,student_id,department_id,time_in,time_in_by_user_id,supervising_officer_user_id,session_type,service_date,credit_cutoff_at)
        VALUES(1,1,1,'2026-10-07T01:00:00Z',1,2,'OPEN_TIME','2026-10-07','2026-10-07T09:00:00Z');
      INSERT INTO violation_actions(violation_id,action,from_status,to_status,performed_by_user_id,performed_by_role) VALUES(1,'INVALID_CANCEL','OPEN','INVALID_CANCEL',1,'DISCIPLINE_ADMIN');
      INSERT INTO notifications(user_id,title,message,notification_type,event_key,is_read,read_at,acknowledged_at) VALUES
        (3,'Assigned','Original assignment text','SERVICE_ASSIGNED','service:1:assigned:student',TRUE,'2026-10-08T01:00:00Z',NULL),
        (2,'Assigned','Original department text','SERVICE_ASSIGNED','service:1:assigned:head',FALSE,NULL,NULL),
        (3,'Time in','Original session text','SERVICE_TIME_IN','service-session:1:time-in',FALSE,NULL,NULL),
        (3,'Violation','Original violation text','VIOLATION_CREATED','violation:1:created',FALSE,NULL,NULL),
        (3,'Cancelled','Original cancellation text','VIOLATION_INVALID_CANCEL','violation-action:1',FALSE,NULL,NULL),
        (3,'Legacy','Do not guess #999','SERVICE_ASSIGNED',NULL,FALSE,NULL,NULL),
        (3,'Security','Original security text',NULL,NULL,TRUE,'2026-10-08T01:00:00Z','2026-10-08T02:00:00Z');
      UPDATE notifications SET category='SECURITY' WHERE id=7;
      INSERT INTO notifications(user_id,title,message,category,resource_type,resource_id,metadata) VALUES
        (1,'Staff time in','Original attendance text','ATTENDANCE','community_service_sessions',1,'{"assignment_id":null}'),
        (1,'Rejected','Original rejected text','ATTENDANCE','community_service_sessions',NULL,'{"student_id":1}');`);
    const before = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
    const migration = fs.readFileSync(path.join(directory, '047_notification_record_targets.sql'), 'utf8');
    await pool.query(migration);
    const after = (await pool.query('SELECT * FROM notifications ORDER BY id')).rows;
    for (let i = 0; i < before.length; i++) for (const field of ['title', 'message', 'is_read', 'read_at', 'acknowledged_at', 'created_at']) assert.deepEqual(after[i][field], before[i][field]);
    assert.equal(after[0].link_path, '/student/community-service?assignment_id=1');
    assert.equal(after[1].link_path, '/department/community-service?assignment_id=1');
    assert.equal(after[2].link_path, '/student/community-service?assignment_id=1&session_id=1');
    assert.equal(after[3].link_path, '/student/violations?violation_id=1');
    assert.equal(after[4].resource_type, 'violations');
    assert.equal(after[5].resource_id, null);
    assert.equal(after[6].link_path, '/student/account-settings?section=security');
    assert.equal(after[7].metadata.assignment_id, 1);
    assert.equal(after[8].resource_type, 'students');
    assert.equal(after[8].link_path, '/admin/students?student_id=1');
    await pool.query(migration);
    assert.deepEqual((await pool.query('SELECT * FROM notifications ORDER BY id')).rows, after);
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
