const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { testDatabaseConfig } = require('./testDatabase');
const { runMigrations } = require('../scripts/migrate');
require('dotenv').config({quiet:true});
const schema = `sti_vio_log_test_attendance_${process.pid}_${Date.now()}`;
const dedicated = testDatabaseConfig();
process.env.DB_SCHEMA = schema;
process.env.DATABASE_URL = dedicated.connectionString;
const pool = require('../src/config/database');
const admin = new Pool(dedicated);
const service = require('../src/services/communityServiceSessionService');
let instant = '2026-10-07T01:00:00Z';
const originalConnect = pool.connect.bind(pool);
const originalQuery = pool.query.bind(pool);
const clockQuery = async (query,params,original) => String(query)==='SELECT clock_timestamp() AS now' ? {rows:[{now:new Date(instant)}]} : original(query,params);
pool.connect = (callback) => {
  if (callback) return originalConnect(callback);
  return (async()=>{
  const client = await originalConnect();
  const query = client.query.bind(client);
  client.query = (sql,params) => clockQuery(sql,params,query);
  const release=client.release.bind(client);
  client.release = () => {client.query=query;client.release=release;release();};
  return client;
  })();
};
pool.query = (sql,params) => clockQuery(sql,params,originalQuery);
const actor={id:1,role:'DISCIPLINE_ADMIN'};
let studentId,departmentId;
const assignment = async (hours=20) => {
  const v=(await pool.query(`INSERT INTO violations(student_id,violation_type_id,incident_date,description,required_service_hours)
    VALUES($1,1,'2026-10-07','Attendance test',$2) RETURNING id`,[studentId,hours])).rows[0];
  return (await pool.query(`INSERT INTO community_service_assignments(violation_id,student_id,department_id,department_head_id,required_hours,remaining_hours)
    VALUES($1,$2,$3,1,$4,$4) RETURNING *`,[v.id,studentId,departmentId,hours])).rows[0];
};
const start = (a,type='FIXED',minutes=120) => service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:2,actor,sessionType:type,selectedDurationMinutes:type==='OPEN_TIME'?null:minutes});
const finish = (a,session) => service.recordTimeOut({assignmentId:a.id,sessionId:session.id,expectedStudentId:studentId,departmentId,actor});

test.before(async()=>{
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool,{logger:{log(){}}});
});
test.beforeEach(async()=>{
  await pool.query('TRUNCATE users,departments,violations,students RESTART IDENTITY CASCADE');
  await pool.query(`INSERT INTO users(username,password_hash,role) VALUES('attendance_admin','hash','DISCIPLINE_ADMIN'),('attendance_head','hash','DEPARTMENT_HEAD'),('attendance_student','hash','STUDENT')`);
  departmentId=(await pool.query(`INSERT INTO departments(department_code,department_name) VALUES('TEST','Test Department') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO department_heads(user_id,department_id,first_name,last_name,qr_scanner_enabled) VALUES(2,$1,'Test','Officer',TRUE)`,[departmentId]);
  await pool.query(`INSERT INTO officer_department_assignments(officer_user_id,department_id,assignment_type,reason,status,created_by_admin_id)
    VALUES(2,$1,'PERMANENT','Attendance test','ACTIVE',1)`,[departmentId]);
  studentId=(await pool.query(`INSERT INTO students(user_id,student_number,first_name,last_name,program,qr_code) VALUES(3,'TEST-001','Test','Student','BSIT','OPAQUE-TEST') RETURNING id`)).rows[0].id;
  instant='2026-10-07T01:00:00Z';
});
test.after(async()=>{await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();});

test('fixed target permits overtime, records raw work and retries Time Out without duplicate credit',async()=>{
  const a=await assignment();const opened=await start(a);
  assert.equal(Number(opened.session.selected_duration_minutes),120);
  instant='2026-10-07T03:05:00Z';
  const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.worked_minutes),125);
  assert.equal(Number(closed.session.credited_minutes),125);
  assert.equal(closed.session.completion_reason,'COMPLETED');
  const again=await finish(a,opened.session);assert.equal(again.already_completed,true);
  const preview=await service.previewTimeOut({sessionId:opened.session.id,departmentId});
  assert.equal(preview.already_completed,true);assert.equal(preview.preview.creditedMinutes,125);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_progress_history')).rows[0].count),1);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM audit_logs WHERE action='TIME_OUT_CREDITED'")).rows[0].count),1);
});
test('concurrent assignments admit exactly one active session per student',async()=>{
  const a=await assignment(),b=await assignment();
  const results=await Promise.allSettled([start(a),start(b)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'ACTIVE_SESSION_EXISTS');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_sessions')).rows[0].count),1);
});
test('daily cap aggregates assignments and caps long sessions while retaining actual time',async()=>{
  const a=await assignment(),b=await assignment();let opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T04:00:00Z';await finish(a,opened.session);
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),180);
  await assert.rejects(start(b,'FIXED',360),e=>e.code==='INVALID_SERVICE_DURATION');
  opened=await start(b,'OPEN_TIME');instant='2026-10-07T10:00:00Z';
  const closed=await finish(b,opened.session);
  assert.equal(Number(closed.session.worked_minutes),360);
  assert.equal(Number(closed.session.credited_minutes),300);
  assert.equal(closed.session.completion_reason,'DAILY_LIMIT_REACHED');
  await assert.rejects(start(a,'OPEN_TIME'),e=>e.code==='INVALID_SERVICE_DURATION');
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),480);
});
test('early exit credits actual minutes and stale IDs cannot close a new session',async()=>{
  const a=await assignment();const opened=await start(a);
  instant='2026-10-07T02:30:59Z';const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.credited_minutes),90);
  assert.equal(closed.session.completion_reason,'EARLY_TIME_OUT');
  const next=await start(a);await finish(a,opened.session);
  assert.equal((await pool.query('SELECT time_out FROM community_service_sessions WHERE id=$1',[next.session.id])).rows[0].time_out,null);
});
test('final fractional balance satisfies the requirement without rounding over it',async()=>{
  const a=await assignment(1.01);
  await pool.query('UPDATE community_service_assignments SET completed_hours=1,remaining_hours=0.01 WHERE id=$1',[a.id]);
  await pool.query('UPDATE violations SET completed_service_hours=1 WHERE id=$1',[a.violation_id]);
  const opened=await start({...a,remaining_hours:0.01},'FIXED',0.6);
  instant='2026-10-07T01:01:00Z';const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.credited_minutes),0.6);
  assert.equal(Number(closed.assignment.completed_hours),1.01);
  assert.equal(Number(closed.assignment.remaining_hours),0);
  assert.equal(closed.assignment.status,'COMPLETED');
});
test('midnight stops yesterday credit and requires staff Time Out before restarting',async()=>{
  instant='2026-10-07T15:00:00Z';const a=await assignment();const opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T18:00:00Z';const preview=await service.previewTimeOut({sessionId:opened.session.id,departmentId});
  assert.equal(preview.preview.creditedMinutes,60);
  assert.equal(preview.preview.completionReason,'DAY_ENDED');
  await assert.rejects(start(a,'OPEN_TIME'),e=>e.code==='ACTIVE_SESSION_EXISTS');
  const closed=await finish(a,opened.session);assert.equal(Number(closed.session.worked_minutes),180);
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),60);
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-08'),0);
  const restarted=await start(a);assert.equal(restarted.session.session_type,'FIXED');
});
test('invalid supervisor, inactive account and invalid duration roll back all attendance writes',async()=>{
  const a=await assignment();
  await assert.rejects(service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:1,actor,sessionType:'FIXED',selectedDurationMinutes:120}),e=>e.code==='UNAUTHORIZED_OFFICER');
  await assert.rejects(start(a,'FIXED',60));
  await pool.query('UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP WHERE id=3');await assert.rejects(start(a));
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_attendance')).rows[0].count),0);
});

test('a progress-write failure rolls back Time Out, events, totals and audit together',async()=>{
  const a=await assignment();const opened=await start(a);instant='2026-10-07T03:00:00Z';
  await pool.query(`CREATE FUNCTION test_fail_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced attendance rollback'; END $$`);
  await pool.query('CREATE TRIGGER test_fail_progress BEFORE INSERT ON community_service_progress_history FOR EACH ROW EXECUTE FUNCTION test_fail_progress()');
  try {
    await assert.rejects(finish(a,opened.session),/forced attendance rollback/);
    assert.equal((await pool.query('SELECT time_out FROM community_service_sessions WHERE id=$1',[opened.session.id])).rows[0].time_out,null);
    assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id=$1',[a.id])).rows[0].completed_hours),0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM community_service_attendance WHERE attendance_type='TIME_OUT'")).rows[0].count),0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM audit_logs WHERE action='TIME_OUT_CREDITED'")).rows[0].count),0);
  } finally {await pool.query('DROP FUNCTION test_fail_progress() CASCADE');}
});

test('concurrent legacy approvals cannot exceed the student daily cap',async()=>{
  const a=await assignment(),b=await assignment();
  const pending = async (assignmentId) => (await pool.query(`INSERT INTO community_service_sessions
    (assignment_id,student_id,department_id,time_in,time_out,worked_minutes,credited_minutes,status,review_status,supervising_officer_user_id,time_in_by_user_id,time_out_by_user_id,service_date)
    VALUES($1,$2,$3,'2026-10-07T01:00:00Z','2026-10-07T09:00:00Z',480,0,'COMPLETED','PENDING',2,1,1,'2026-10-07') RETURNING id`,[assignmentId,studentId,departmentId])).rows[0].id;
  const ids=await Promise.all([pending(a.id),pending(b.id)]);
  const results=await Promise.all(ids.map(sessionId=>service.reviewServiceResult({sessionId,decision:'APPROVE',reviewNotes:'Verified attendance',actor})));
  assert.equal(results.reduce((sum,r)=>sum+Number(r.session.credited_minutes),0),480);
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),480);
});

test('six-decimal hour balances close exactly and fractional timers reach zero',async()=>{
  const a=await assignment(5);
  await pool.query('UPDATE community_service_assignments SET completed_hours=4.083333,remaining_hours=0.916667 WHERE id=$1',[a.id]);
  await pool.query('UPDATE violations SET completed_service_hours=4.083333 WHERE id=$1',[a.violation_id]);
  const opened=await start(a,'FIXED',55.00002);
  instant='2026-10-07T02:00:00Z';
  const preview=await service.previewTimeOut({sessionId:opened.session.id,departmentId});
  assert.equal(preview.preview.target_completed,true);
  assert.equal(preview.preview.remaining_seconds,0);
  const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.credited_minutes),55.00002);
  assert.equal(Number(closed.assignment.completed_hours),5);
  assert.equal(Number(closed.assignment.remaining_hours),0);
});

test('recorder permissions revoked after verification block transactional attendance writes',async()=>{
  const a=await assignment();
  const head={id:2,role:'DEPARTMENT_HEAD',department_id:departmentId,session_version:1};
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=FALSE WHERE user_id=2');
  await assert.rejects(service.recordTimeIn({assignmentId:a.id,departmentId,actor:head,sessionType:'FIXED',selectedDurationMinutes:120,supervisingOfficerId:2}),e=>e.code==='RECORDER_NOT_AUTHORIZED');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_sessions')).rows[0].count),0);
});

test('legacy approval cannot close an assignment while its current session is active',async()=>{
  const a=await assignment(2);const opened=await start(a);
  const pending=(await pool.query(`INSERT INTO community_service_sessions
    (assignment_id,student_id,department_id,time_in,time_out,worked_minutes,credited_minutes,status,review_status,supervising_officer_user_id,time_in_by_user_id,time_out_by_user_id,service_date)
    VALUES($1,$2,$3,'2026-10-07T00:00:00Z','2026-10-07T02:00:00Z',120,0,'COMPLETED','PENDING',2,1,1,'2026-10-07') RETURNING id`,[a.id,studentId,departmentId])).rows[0];
  await assert.rejects(service.reviewServiceResult({sessionId:pending.id,decision:'APPROVE',reviewNotes:'Legacy evidence',actor}),error=>error.code==='ACTIVE_SESSION_EXISTS');
  assert.equal((await pool.query('SELECT time_out FROM community_service_sessions WHERE id=$1',[opened.session.id])).rows[0].time_out,null);
  instant='2026-10-07T02:00:00Z';assert.equal((await finish(a,opened.session)).session.status,'COMPLETED');
});
