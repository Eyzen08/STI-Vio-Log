const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PERMISSIONS } = require('../src/security/permissions');
const { createSupportAccessService, expireSupportAccessGrants } = require('../src/services/supportAccessService');
const { authorizePermissions } = require('../src/middleware/authMiddleware');

const response = () => ({ statusCode:200, payload:null, status(code){this.statusCode=code;return this;}, json(value){this.payload=value;return this;} });

test('read-only support scope can satisfy permission middleware without changing the stored role', async () => {
  const req={method:'GET',user:{role:'SYSTEM_ADMIN',must_change_password:false,permissions:[PERMISSIONS.GUARDIAN_CONTACT_VIEW]}};
  let allowed=false;
  await authorizePermissions(PERMISSIONS.GUARDIAN_CONTACT_VIEW)(req,response(),()=>{allowed=true;});
  assert.equal(allowed,true);
  assert.equal(req.user.role,'SYSTEM_ADMIN');
});

test('unapproved support scope remains denied', () => {
  const req={user:{role:'SYSTEM_ADMIN',must_change_password:false,permissions:[PERMISSIONS.SYSTEM_HEALTH_VIEW]}};
  const res=response();
  authorizePermissions(PERMISSIONS.GUARDIAN_CONTACT_VIEW)(req,res,()=>assert.fail('must remain denied'));
  assert.equal(res.statusCode,403);
});

test('support requests accept only bounded read scopes and explicitly refuse writes', async () => {
  const pool={query:async(sql,params=[])=>sql.includes("SELECT id FROM users")?{rows:[]}:{rows:[{id:1,requested_scopes:params[3]}]}};
  const service=createSupportAccessService({pool});
  const created=await service.request({requesterId:8,reason:'Investigate ticket INC-7 safely',affectedModule:'Guardian contact',scopes:[PERMISSIONS.GUARDIAN_CONTACT_VIEW],durationMinutes:30});
  assert.deepEqual(created.requested_scopes,[PERMISSIONS.GUARDIAN_CONTACT_VIEW]);
  await assert.rejects(()=>service.request({requesterId:8,reason:'Need to change a protected record',affectedModule:'Violations',scopes:[PERMISSIONS.STUDENT_BASIC_VIEW],durationMinutes:30,readOnly:false}),/write access is not enabled/i);
  await assert.rejects(()=>service.request({requesterId:8,reason:'Attempt unrelated scope safely',affectedModule:'Violations',scopes:[PERMISSIONS.VIOLATION_UPDATE],durationMinutes:30}),/valid reason/i);
});

test('approval requires a different administrator and scopes remain a requested subset', async () => {
  const request={id:4,requester_user_id:10,status:'PENDING',requested_scopes:[PERMISSIONS.REPORT_VIEW]};
  const makeClient=()=>({queries:[],async query(sql){this.queries.push(sql);if(sql.startsWith('SELECT *'))return{rows:[request]};return{rows:[request]};},release(){}});
  await assert.rejects(()=>createSupportAccessService({pool:{connect:async()=>makeClient()}}).decide({approverId:10,requestId:4,approve:true,scopes:[PERMISSIONS.REPORT_VIEW],decisionReason:'Approved for ticket review'}),/different Discipline Administrator/);
  await assert.rejects(()=>createSupportAccessService({pool:{connect:async()=>makeClient()}}).decide({approverId:11,requestId:4,approve:true,scopes:[PERMISSIONS.GUARDIAN_CONTACT_VIEW],decisionReason:'Approved for ticket review'}),/subset/);
});

test('active grants are loaded from current status, expiry, and revocation state on every request', () => {
  const source=fs.readFileSync(require.resolve('../src/middleware/authMiddleware'),'utf8');
  assert.match(source,/sar\.status='APPROVED'/);
  assert.match(source,/sar\.revoked_at IS NULL/);
  assert.match(source,/sar\.expires_at>CURRENT_TIMESTAMP/);
  assert.match(source,/SELECT jsonb_agg\(DISTINCT scope\)/);
});

test('each protected read through temporary support access creates a correlated use event', () => {
  const source=fs.readFileSync(require.resolve('../src/middleware/authMiddleware'),'utf8');
  assert.match(source,/SUPPORT_ACCESS_USED/);
  assert.match(source,/supportAccessRequestId:req\.user\.support_access_request_id/);
  assert.match(source,/result:'SUCCESS'/);
});

test('expired support grants are closed and notify both responsible roles',async()=>{
  const calls=[];
  const database={async query(sql,params=[]){calls.push({sql:String(sql),params});if(String(sql).startsWith('UPDATE support_access_requests'))return{rows:[{id:7,requester_user_id:4,approver_user_id:8,affected_module:'Guardian contact',expires_at:new Date().toISOString()}]};if(String(sql).includes("role='DISCIPLINE_ADMIN'"))return{rows:[{id:8},{id:9}]};if(String(sql).startsWith('INSERT INTO notifications'))return{rows:[{id:calls.length}]};return{rows:[]}}};
  assert.equal(await expireSupportAccessGrants(database),1);
  const sql=calls.map((entry)=>entry.sql).join('\n');
  assert.match(sql,/status='EXPIRED'/);assert.match(sql,/SUPPORT_ACCESS_EXPIRED/);assert.match(sql,/administrative_security_events/);
  assert.equal(calls.filter((entry)=>entry.sql.startsWith('INSERT INTO notifications')).length,3);
});
