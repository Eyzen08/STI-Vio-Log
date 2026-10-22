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
const dayPreview = (a,date='2026-10-07',who=actor) => service.previewDayInvalidation({assignmentId:a.id,date,actor:who});
const invalidateDay = async (a,date='2026-10-07',options={}) => {
  const preview = options.preview || await dayPreview(a,date,options.actor || actor);
  return service.invalidateServiceDay({assignmentId:a.id,date,actor,reason:'Student did not return',previewVersion:preview.preview_version,...options});
};
let studentId,departmentId;
const assignment = async (hours=20) => {
  const v=(await pool.query(`INSERT INTO violations(student_id,violation_type_id,incident_date,description,required_service_hours)
    VALUES($1,1,'2026-10-07','Attendance test',$2) RETURNING id`,[studentId,hours])).rows[0];
  return (await pool.query(`INSERT INTO community_service_assignments(violation_id,student_id,department_id,department_head_id,required_hours,remaining_hours)
    VALUES($1,$2,$3,1,$4,$4) RETURNING *`,[v.id,studentId,departmentId,hours])).rows[0];
};
const start = async (a,type='FIXED',minutes=120) => {
  const result=await service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:2,actor,sessionType:type,selectedDurationMinutes:type==='OPEN_TIME'?null:minutes});
  // Keep the responsibility fixture on the same controlled clock as the session.
  await pool.query('UPDATE community_service_session_officer_history SET starts_at=$2 WHERE session_id=$1',[result.session.id,result.session.time_in]);
  return result;
};
const finish = (a,session) => service.recordTimeOut({assignmentId:a.id,sessionId:session.id,expectedStudentId:studentId,departmentId,actor});
const pause = (session,reason='Scheduled break',overrides={}) => service.setSessionPaused({sessionId:session.id,departmentId,actor,paused:true,reason,...overrides});
const resume = (session,overrides={}) => service.setSessionPaused({sessionId:session.id,departmentId,actor,paused:false,...overrides});
const pauseRows = async (session) => (await pool.query('SELECT * FROM community_service_session_pauses WHERE session_id=$1 ORDER BY started_at,id',[session.id])).rows;
const currentSession = async (session) => (await service.hydrateSessions(pool,(await pool.query(`SELECT css.*,a.required_hours,a.completed_hours,a.remaining_hours
  FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id WHERE css.id=$1`,[session.id])).rows))[0];

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

test('legacy duration selections open flexible sessions and complete fractional-hour assignments exactly',async()=>{
  for (const [hours,minutes] of [[6.5,390],[1.5,90],[0.01,0.6],[5.500001,330.00006]]) {
    const a=await assignment(hours)
    const opened=await start(a,'FIXED',minutes)
    assert.equal(opened.session.session_type,'OPEN_TIME')
    assert.equal(opened.session.selected_duration_minutes,null)
    // Existing Time Out constraints require whole worked minutes to cover fractional credit.
    instant=new Date(Date.parse(instant)+Math.ceil(minutes)*60000).toISOString()
    const closed=await finish(a,opened.session)
    assert.equal(Number(closed.session.credited_minutes),minutes)
    assert.equal(Number(closed.assignment.remaining_hours),0)
    assert.equal(closed.assignment.status,'COMPLETED')
    instant=new Date(Date.parse(instant)+86400000).toISOString()
  }
});

test('stale All remaining selections roll back when the live balance or allowance changes',async()=>{
  const a=await assignment(6.5)
  await assert.rejects(start(a,'FIXED',150),e=>e.code==='INVALID_SERVICE_DURATION')
  const served=await assignment(2)
  const opened=await start(served)
  instant='2026-10-07T03:00:00Z'
  await finish(served,opened.session)
  await assert.rejects(start(a,'FIXED',390),e=>e.code==='INVALID_SERVICE_DURATION')
  await pool.query('UPDATE community_service_assignments SET completed_hours=1,remaining_hours=5.5 WHERE id=$1',[a.id])
  await assert.rejects(start(a,'FIXED',390),e=>e.code==='INVALID_SERVICE_DURATION')
  instant='2026-10-07T15:30:00Z'
  await assert.rejects(start(a,'FIXED',330),e=>e.code==='INVALID_SERVICE_DURATION')
  const short=await assignment(1.5)
  await assert.rejects(start(short,'FIXED',90),e=>e.code==='INVALID_SERVICE_DURATION')
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_sessions')).rows[0].count),1)
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_attendance')).rows[0].count),2)
});

test('legacy fixed selection opens flexible attendance and retries Time Out without duplicate credit',async()=>{
  const a=await assignment();const opened=await start(a);
  assert.equal(opened.session.session_type,'OPEN_TIME');
  assert.equal(opened.session.selected_duration_minutes,null);
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
test('flexible attendance under two hours credits actual minutes normally and stale IDs cannot close a new session',async()=>{
  const a=await assignment();const opened=await start(a);
  instant='2026-10-07T02:30:59Z';const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.credited_minutes),90);
  assert.equal(closed.session.completion_reason,'COMPLETED');
  assert.equal(closed.session.service_condition,'TODAYS_SERVICE_COMPLETED');
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
  const restarted=await start(a);assert.equal(restarted.session.session_type,'OPEN_TIME');
});
test('invalid supervisor, inactive account and invalid duration roll back all attendance writes',async()=>{
  const a=await assignment();
  await assert.rejects(service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:1,actor,sessionType:'FIXED',selectedDurationMinutes:120}),e=>e.code==='UNAUTHORIZED_OFFICER');
  await assert.rejects(start(a,'FIXED',60));
  await pool.query('UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP WHERE id=3');await assert.rejects(start(a));
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_attendance')).rows[0].count),0);
});

test('a progress-write failure rolls back Time Out, events, totals and audit together',async()=>{
  const a=await assignment();const opened=await start(a);instant='2026-10-07T02:00:00Z';await pause(opened.session);instant='2026-10-07T03:00:00Z';
  await pool.query(`CREATE FUNCTION test_fail_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced attendance rollback'; END $$`);
  await pool.query('CREATE TRIGGER test_fail_progress BEFORE INSERT ON community_service_progress_history FOR EACH ROW EXECUTE FUNCTION test_fail_progress()');
  try {
    await assert.rejects(finish(a,opened.session),/forced attendance rollback/);
    assert.equal((await pool.query('SELECT time_out FROM community_service_sessions WHERE id=$1',[opened.session.id])).rows[0].time_out,null);
    assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id=$1',[a.id])).rows[0].completed_hours),0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM community_service_attendance WHERE attendance_type='TIME_OUT'")).rows[0].count),0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM audit_logs WHERE action='TIME_OUT_CREDITED'")).rows[0].count),0);
    assert.equal((await pauseRows(opened.session))[0].ended_at,null);
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
  assert.equal(preview.preview.limit_reached,true);
  assert.equal(preview.preview.credit_remaining_seconds,0);
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

test('Time In needs no duration and still rejects malformed legacy selections',async()=>{
  const a=await assignment();
  for (const input of [{sessionType:'FIXED',selectedDurationMinutes:60},{sessionType:'OPEN_TIME',selectedDurationMinutes:120},{sessionType:'BOGUS'}, {selectedDurationMinutes:120}]) {
    await assert.rejects(service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:2,actor,...input}),error=>error.code==='INVALID_SERVICE_DURATION');
  }
  const opened=await service.recordTimeIn({assignmentId:a.id,expectedStudentId:studentId,departmentId,supervisingOfficerId:2,actor});
  assert.equal(opened.session.session_type,'OPEN_TIME');
  assert.equal(opened.session.selected_duration_minutes,null);
});

test('pause ledger retains trimmed reasons and actors; repeated transitions are idempotent',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T01:30:00Z';
  await pause(opened.session,'  Lunch break  ');
  await Promise.all([pause(opened.session,'Duplicate request'),pause(opened.session,'Duplicate request')]);
  let rows=await pauseRows(opened.session),session=await currentSession(opened.session);
  assert.equal(rows.length,1);assert.equal(rows[0].reason,'Lunch break');
  assert.equal(Number(rows[0].started_by_user_id),actor.id);
  assert.equal(rows[0].started_at.toISOString(),instant.replace('Z','.000Z'));
  assert.equal(rows[0].ended_at,null);assert.equal(session.status,'ACTIVE');
  assert.equal(new Date(session.paused_at).toISOString(),instant.replace('Z','.000Z'));
  assert.equal(Number(session.paused_seconds),0);
  await assert.rejects(start(await assignment(),'OPEN_TIME'),error=>error.code==='ACTIVE_SESSION_EXISTS');
  instant='2026-10-07T02:00:00Z';
  await Promise.all([resume(opened.session),resume(opened.session)]);
  rows=await pauseRows(opened.session);session=await currentSession(opened.session);
  assert.equal(rows.length,1);assert.equal(Number(rows[0].ended_by_user_id),actor.id);
  assert.equal(rows[0].ended_at.toISOString(),'2026-10-07T02:00:00.000Z');
  assert.equal(session.paused_at,null);assert.equal(Number(session.paused_seconds),1800);
  const hydrated=(await service.hydrateSessions(pool,[{...session,...a,id:session.id,time_in:session.time_in}]))[0];
  assert.equal(hydrated.pause_history.length,1);
  assert.equal(hydrated.pause_history[0].reason,'Lunch break');
  assert.ok(hydrated.pause_history[0].started_by_name);
  assert.ok(hydrated.pause_history[0].ended_by_name);
});

test('multiple fractional pause intervals aggregate before whole working minutes are rounded',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T01:00:10.100Z';await pause(opened.session);
  instant='2026-10-07T01:00:40.600Z';await resume(opened.session);
  instant='2026-10-07T01:01:00.100Z';await pause(opened.session,'Second break');
  instant='2026-10-07T01:01:30.600Z';await resume(opened.session);
  instant='2026-10-07T01:03:00Z';
  const preview=await service.previewTimeOut({sessionId:opened.session.id,departmentId});
  assert.equal(preview.preview.workedMinutes,1);assert.equal(preview.preview.creditedMinutes,1);
  const closed=await finish(a,opened.session);
  assert.equal(Number((await currentSession(opened.session)).paused_seconds),61);
  assert.equal(Number(closed.session.worked_minutes),1);assert.equal(Number(closed.session.credited_minutes),1);
  assert.equal(closed.session.service_condition,'TODAYS_SERVICE_COMPLETED');
  assert.equal((await pauseRows(opened.session)).length,2);
});

test('Time Out while paused ends the interval at departure without counting the break',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T01:45:30Z';await pause(opened.session,'Left on break');
  instant='2026-10-07T03:00:00Z';
  const closed=await finish(a,opened.session),rows=await pauseRows(opened.session);
  assert.equal(Number(closed.session.worked_minutes),45);assert.equal(Number(closed.session.credited_minutes),45);
  const completed=await currentSession(opened.session);
  assert.equal(completed.paused_at,null);assert.equal(Number(completed.paused_seconds),4470);
  assert.equal(rows[0].ended_at.toISOString(),closed.session.time_out.toISOString());
  assert.equal(Number(rows[0].ended_by_user_id),actor.id);
  await finish(a,opened.session);
  await assert.rejects(pause(opened.session),error=>error.statusCode===409);
  await assert.rejects(resume(opened.session),error=>error.statusCode===409);
  assert.equal((await pauseRows(opened.session)).length,1);
});

test('pauses move requirement and daily cutoffs later while retaining their credit caps',async()=>{
  const a=await assignment(2),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T02:00:00Z';await pause(opened.session);
  instant='2026-10-07T03:00:00Z';await resume(opened.session);
  let preview=await service.previewTimeOut({sessionId:opened.session.id,departmentId});
  assert.equal(preview.preview.creditedMinutes,60);assert.equal(preview.preview.limit_reached,false);
  assert.equal(new Date(preview.preview.credit_cutoff_at).toISOString(),'2026-10-07T04:00:00.000Z');
  instant='2026-10-07T04:30:00Z';
  const closed=await finish(a,opened.session);
  assert.equal(Number(closed.session.worked_minutes),150);assert.equal(Number(closed.session.credited_minutes),120);
  const b=await assignment(),second=await start(b,'OPEN_TIME');
  instant='2026-10-07T05:00:00Z';await pause(second.session);
  instant='2026-10-07T06:00:00Z';await resume(second.session);
  instant='2026-10-07T11:00:00Z';preview=await service.previewTimeOut({sessionId:second.session.id,departmentId});
  assert.equal(preview.preview.creditedMinutes,330);
  instant='2026-10-07T12:00:00Z';
  const capped=await finish(b,second.session);
  assert.equal(Number(capped.session.worked_minutes),390);assert.equal(Number(capped.session.credited_minutes),360);
  assert.equal(capped.session.completion_reason,'DAILY_LIMIT_REACHED');
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),480);
});

test('midnight clips paused credit, disallows resume and never carries yesterday into today',async()=>{
  instant='2026-10-07T15:00:00Z';const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T15:30:00Z';await pause(opened.session);
  instant='2026-10-07T17:00:00Z';
  await assert.rejects(resume(opened.session),error=>error.statusCode===409);
  const closed=await finish(a,opened.session),rows=await pauseRows(opened.session);
  assert.equal(Number(closed.session.credited_minutes),30);assert.equal(Number(closed.session.worked_minutes),30);
  assert.equal(closed.session.completion_reason,'DAY_ENDED');
  assert.equal(rows[0].ended_at.toISOString(),'2026-10-07T17:00:00.000Z');
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-07'),30);
  assert.equal(await service.dailyCredit(pool,studentId,'2026-10-08'),0);
  const restarted=await start(a,'OPEN_TIME');
  assert.equal((await pool.query('SELECT service_date::text FROM community_service_sessions WHERE id=$1',[restarted.session.id])).rows[0].service_date,'2026-10-08');
});

test('pause validates reason, department, live recorder permission and supervisor availability atomically',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  for (const reason of [undefined,null,'','   ',1,'x'.repeat(501)]) await assert.rejects(pause(opened.session,reason,{reason}),error=>error.statusCode===400);
  await assert.rejects(pause(opened.session,'Wrong department',{departmentId:Number(departmentId)+1}),error=>[403,404,409].includes(error.statusCode));
  await assert.rejects(pause(opened.session,'Student cannot pause',{actor:{id:3,role:'STUDENT'}}),error=>error.statusCode===403);
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=FALSE WHERE user_id=2');
  await assert.rejects(pause(opened.session,'Revoked recorder',{actor:{id:2,role:'DEPARTMENT_HEAD',department_id:departmentId,session_version:1}}),error=>error.statusCode===403);
  await pool.query('UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP WHERE id=2');
  await assert.rejects(pause(opened.session),error=>[403,409].includes(error.statusCode));
  assert.equal((await pauseRows(opened.session)).length,0);
  assert.equal((await currentSession(opened.session)).paused_at,null);
});

test('concurrent Pause, Resume and Time Out close once with no open pause or duplicate credit',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T02:00:00Z';await pause(opened.session);
  instant='2026-10-07T02:15:00Z';
  const results=await Promise.allSettled([resume(opened.session),pause(opened.session,'Concurrent break'),finish(a,opened.session),finish(a,opened.session)]);
  for (const result of results.filter(result=>result.status==='rejected')) assert.equal(result.reason.statusCode,409);
  const session=await currentSession(opened.session),rows=await pauseRows(opened.session);
  assert.equal(session.status,'COMPLETED');assert.equal(session.paused_at,null);
  assert.equal(Number(session.worked_minutes),60);assert.equal(Number(session.credited_minutes),60);
  assert.ok(rows.every(row=>row.ended_at));
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM community_service_progress_history WHERE session_id=$1',[session.id])).rows[0].count),1);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM community_service_attendance WHERE attendance_type='TIME_OUT'")).rows[0].count),1);
});

test('audit failure rolls back a pause and resume rechecks live authorization',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  await pool.query(`CREATE FUNCTION test_fail_pause_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced pause audit rollback'; END $$`);
  await pool.query('CREATE TRIGGER test_fail_pause_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_fail_pause_audit()');
  try {
    await assert.rejects(pause(opened.session),/forced pause audit rollback/);
    assert.equal((await pauseRows(opened.session)).length,0);
  } finally {await pool.query('DROP FUNCTION test_fail_pause_audit() CASCADE');}
  instant='2026-10-07T01:30:00Z';await pause(opened.session,'x'.repeat(500));
  await pool.query('UPDATE users SET is_active=FALSE,deactivated_at=CURRENT_TIMESTAMP WHERE id=1');
  await assert.rejects(resume(opened.session),error=>error.statusCode===403);
  assert.equal((await pauseRows(opened.session))[0].ended_at,null);
});

test('day invalidation removes all day credits, closes paused attendance and retries without a second deduction',async()=>{
  const a=await assignment(),first=await start(a,'OPEN_TIME');
  instant='2026-10-07T02:00:00Z';await finish(a,first.session);
  const second=await start(a,'OPEN_TIME');
  instant='2026-10-07T03:00:00Z';await pause(second.session,'Break');
  instant='2026-10-07T04:00:00Z';
  const preview=await dayPreview(a);
  assert.equal(preview.sessions.length,2);assert.equal(preview.removed_credit_minutes,60);
  const result=await invalidateDay(a,'2026-10-07',{preview});
  assert.equal(Number(result.assignment.completed_hours),0);assert.equal(Number(result.assignment.remaining_hours),20);
  const sessions=(await pool.query('SELECT * FROM community_service_sessions WHERE assignment_id=$1 ORDER BY id',[a.id])).rows;
  assert.ok(sessions.every(row=>row.day_invalidation_id&&Number(row.credited_minutes)===0&&row.time_out));
  assert.equal(Number(sessions[0].original_credited_minutes),60);
  assert.equal(sessions[1].completion_reason,'DAY_INVALIDATED');
  assert.equal((await pauseRows(second.session))[0].ended_by_user_id,actor.id.toString());
  assert.equal(Number(await service.dailyCredit(pool,studentId,'2026-10-07')),120);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM community_service_attendance WHERE attendance_type='TIME_OUT'")).rows[0].n),1);
  const retry=await invalidateDay(a,'2026-10-07',{preview});assert.equal(retry.already_invalidated,true);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM community_service_day_invalidations')).rows[0].n),1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM community_service_hour_corrections')).rows[0].n),0);
  await assert.rejects(start(a,'OPEN_TIME'),e=>e.code==='SERVICE_DAY_INVALIDATED');
  instant='2026-10-08T01:00:00Z';assert.ok((await start(a,'OPEN_TIME')).session);
});

test('past date invalidation preserves other dates, assignments, fractional credit and audit history',async()=>{
  const a=await assignment(),other=await assignment();let opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T02:00:00Z';await finish(a,opened.session);
  opened=await start(other,'OPEN_TIME');instant='2026-10-07T03:00:00Z';await finish(other,opened.session);
  instant='2026-10-08T01:00:00Z';opened=await start(a,'OPEN_TIME');
  instant='2026-10-08T02:00:00Z';await finish(a,opened.session);
  await pool.query('UPDATE community_service_sessions SET credited_minutes=59.99994 WHERE assignment_id=$1 AND service_date=$2',[a.id,'2026-10-07']);
  await pool.query('UPDATE community_service_assignments SET completed_hours=1.999999,remaining_hours=18.000001 WHERE id=$1',[a.id]);
  await pool.query('UPDATE violations SET completed_service_hours=1.999999 WHERE id=$1',[a.violation_id]);
  const before=(await pool.query('SELECT * FROM community_service_progress_history ORDER BY id')).rows;
  const result=await invalidateDay(a);
  assert.equal(Number(result.assignment.completed_hours),1);assert.equal(Number(result.assignment.remaining_hours),19);
  assert.equal(Number(await service.dailyCredit(pool,studentId,'2026-10-07')),119.99994);
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id=$1',[other.id])).rows[0].completed_hours),1);
  assert.deepEqual((await pool.query('SELECT * FROM community_service_progress_history ORDER BY id')).rows,before);
  const hydrated=(await currentSession(opened.session));assert.equal(hydrated.day_invalidation,null);
});

test('day invalidation requires a current preview, valid reason, real nonfuture service date and an open assignment',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T02:00:00Z';const preview=await dayPreview(a);
  await pause(opened.session,'Changed after preview');
  await assert.rejects(invalidateDay(a,'2026-10-07',{preview}),e=>e.code==='STALE_DAY_PREVIEW');
  for(const reason of ['', ' ', 'x'.repeat(501),null]) await assert.rejects(invalidateDay(a,'2026-10-07',{reason}),e=>e.statusCode===400);
  for(const date of ['2026-02-30','2026-10-08','bad']) await assert.rejects(dayPreview(a,date),e=>e.statusCode===400);
  await assert.rejects(dayPreview(a,'2026-10-06'),e=>e.statusCode===404);
  await finish(a,opened.session);
  await pool.query("UPDATE community_service_assignments SET status='COMPLETED' WHERE id=$1",[a.id]);
  await assert.rejects(dayPreview(a),e=>e.statusCode===409);
});

test('authorized heads may invalidate only their active department and live authorization is rechecked',async()=>{
  const a=await assignment();await start(a,'OPEN_TIME');
  const head={id:2,role:'DEPARTMENT_HEAD',department_id:departmentId};
  await assert.rejects(dayPreview(a,'2026-10-07',{id:3,role:'STUDENT'}),e=>e.statusCode===403);
  await assert.rejects(dayPreview(a,'2026-10-07',{...head,department_id:Number(departmentId)+1}),e=>e.statusCode===403);
  const preview=await dayPreview(a,'2026-10-07',head);
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=FALSE WHERE user_id=2');
  await assert.rejects(invalidateDay(a,'2026-10-07',{actor:head,preview}),e=>e.statusCode===403);
  await pool.query('UPDATE department_heads SET qr_scanner_enabled=TRUE WHERE user_id=2');
  const result=await invalidateDay(a,'2026-10-07',{actor:head,preview});assert.equal(result.invalidation.performed_by_user_id,'2');
});

test('office corrections cannot make cancellation negative and audit failure rolls the whole cancellation back',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');instant='2026-10-07T02:00:00Z';await finish(a,opened.session);
  await pool.query('UPDATE community_service_assignments SET completed_hours=0,remaining_hours=20 WHERE id=$1',[a.id]);
  await assert.rejects(dayPreview(a),e=>e.code==='CREDIT_RECONCILIATION_REQUIRED');
  await pool.query('UPDATE community_service_assignments SET completed_hours=1,remaining_hours=19 WHERE id=$1',[a.id]);
  const preview=await dayPreview(a);
  await pool.query(`CREATE FUNCTION test_fail_invalidation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced invalidation rollback'; END $$`);
  await pool.query('CREATE TRIGGER test_fail_invalidation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_fail_invalidation_audit()');
  try {await assert.rejects(invalidateDay(a,'2026-10-07',{preview}),/forced invalidation rollback/)} finally {await pool.query('DROP FUNCTION test_fail_invalidation_audit() CASCADE')}
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM community_service_day_invalidations')).rows[0].n),0);
  assert.equal(Number((await currentSession(opened.session)).credited_minutes),60);
});

test('concurrent time-out and day cancellation never double-credit or double-deduct',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');instant='2026-10-07T02:00:00Z';
  const preview=await dayPreview(a);
  const results=await Promise.allSettled([invalidateDay(a,'2026-10-07',{preview}),finish(a,opened.session)]);
  for(const result of results.filter(row=>row.status==='rejected')) assert.equal(result.reason.statusCode,409);
  const refreshed=await dayPreview(a);if(!refreshed.already_invalidated)await invalidateDay(a,'2026-10-07',{preview:refreshed});
  assert.equal(Number((await currentSession(opened.session)).credited_minutes),0);
  assert.equal(Number((await pool.query('SELECT completed_hours FROM community_service_assignments WHERE id=$1',[a.id])).rows[0].completed_hours),0);
});

test('invalidated days remain visible to QR verification, reports and students, with no legacy reapproval',async()=>{
  const a=await assignment(),opened=await start(a,'OPEN_TIME');instant='2026-10-07T02:00:00Z';await finish(a,opened.session);
  const result=await invalidateDay(a);
  const res=()=>({statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
  const qr=res();await require('../src/controllers/qrController').scanQrCode({user:actor,body:{qr_code:'OPAQUE-TEST'}},qr);
  assert.equal(qr.statusCode,200);assert.equal(qr.body.assignment.day_invalidated,true);
  assert.equal(qr.body.allowance.available_minutes,0);assert.equal(qr.body.allowance.daily_remaining_minutes,420);
  await pool.query("UPDATE community_service_sessions SET review_status='PENDING' WHERE id=$1",[opened.session.id]);
  await assert.rejects(service.reviewServiceResult({sessionId:opened.session.id,decision:'APPROVE',reviewNotes:'Legacy approval',actor}),e=>e.code==='SERVICE_DAY_INVALIDATED');
  const reports=require('../src/controllers/communityServiceSessionReportController');
  const report=await reports.loadDTRReport({user:actor,query:{from:'2026-10-07',to:'2026-10-07',assignment_id:a.id}});
  assert.equal(report.totals.credited_minutes,0);assert.equal(report.data[0].invalidated_credit_minutes,60);
  assert.equal(report.data[0].attendance_outcome,'DAY_INVALIDATED');assert.equal(report.dayInvalidations.length,1);
  assert.equal(report.dayInvalidations[0].performed_by_name,'attendance_admin');
  const empty=await reports.loadDTRReport({user:actor,query:{from:'2026-10-08'}});assert.equal(empty.dayInvalidations.length,0);
  const student=res();await reports.getMyDTR({user:{id:3,role:'STUDENT'},query:{}},student);
  assert.equal(student.body.sessions[0].day_invalidation.reason,'Student did not return');
  assert.equal(student.body.sessions[0].attendance_outcome,'DAY_INVALIDATED');
  const workbook=require('../src/services/reportExport').createReportWorkbook('dtr',report);
  assert.ok(workbook.getWorksheet('Invalidated Days').getRow(7).values.includes('Student did not return'));
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM notifications WHERE notification_type='SERVICE_DAY_INVALIDATED'")).rows[0].n),1);
  await assert.rejects(pool.query('UPDATE community_service_day_invalidations SET reason=$2 WHERE id=$1',[result.invalidation.id,'Erase reason']),/append-only/);
  await assert.rejects(pool.query('DELETE FROM community_service_day_invalidations WHERE id=$1',[result.invalidation.id]),/append-only/);
});

test('zero-credit active cancellation crosses Manila midnight without moving its date or freeing allowance',async()=>{
  const a=await assignment();instant='2026-10-07T15:30:00Z';const opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T15:40:00Z';await pause(opened.session,'Did not return');
  instant='2026-10-08T01:00:00Z';const result=await invalidateDay(a);
  assert.equal(Number(result.invalidation.removed_credit_minutes),0);
  assert.equal(Number(await service.dailyCredit(pool,studentId,'2026-10-07')),10);
  assert.equal(Number(await service.dailyCredit(pool,studentId,'2026-10-08')),0);
  const newSession=await start(a,'OPEN_TIME');assert.equal(newSession.session.service_date,'2026-10-08');
});

test('invalidating one assignment does not grant extra daily allowance to another assignment',async()=>{
  const a=await assignment(),other=await assignment(),opened=await start(a,'OPEN_TIME');
  instant='2026-10-07T08:00:00Z';await finish(a,opened.session);await invalidateDay(a);
  const next=await start(other,'OPEN_TIME');assert.equal(next.session.credit_limit_seconds,3600);
  instant='2026-10-07T10:00:00Z';const result=await finish(other,next.session);
  assert.equal(Number(result.session.credited_minutes),60);assert.equal(Number(await service.dailyCredit(pool,studentId,'2026-10-07')),480);
});
