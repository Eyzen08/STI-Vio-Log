const test=require('node:test');
const assert=require('node:assert/strict');
const {createAuthController}=require('../src/controllers/authController');

const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const requestFor=(username,password)=>({body:{username,password}});

for(const role of ['SYSTEM_ADMIN','DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD','STUDENT'])test(`valid ${role} password login derives its role from the database`,async()=>{
  const controller=createAuthController({database:{async query(sql,params){if(sql.startsWith('UPDATE users')){assert.equal(params[0],4);return{rows:[]}}assert.equal(params[0],'account');assert.equal(sql.includes('role=$'),false);return{rows:[{id:4,username:'account',role,password_hash:'hash',session_version:1,must_change_password:false,email_verified:true,first_name:'Pedro',last_name:'Makisig'}]}}},comparePassword:async()=>true,jwtSecret:()=> 's'.repeat(48),issueToken:user=>`token-${user.role}`,auditSecurityEvent:async()=>true});
  const res=response();await controller.loginUser(requestFor('account','UniquePass@1234'),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.user.role,role);assert.equal(res.body.user.full_name,'Pedro Makisig');assert.equal(res.body.token,`token-${role}`);
});

test('invalid username and invalid password use the same generic response',async()=>{
  const missing=createAuthController({database:{async query(){return{rows:[]}}},comparePassword:async()=>false,auditSecurityEvent:async()=>true});
  const wrong=createAuthController({database:{async query(){return{rows:[{password_hash:'hash'}]}}},comparePassword:async()=>false,auditSecurityEvent:async()=>true});
  const first=response(),second=response();await missing.loginUser(requestFor('missing','Wrong@123'),first);await wrong.loginUser(requestFor('account','Wrong@123'),second);
  assert.equal(first.statusCode,401);assert.equal(second.statusCode,401);assert.equal(first.body.message,second.body.message);
});

test('student password login accepts the official student number when it differs from the username',async()=>{
  const queries=[];
  const controller=createAuthController({database:{async query(sql,params){queries.push({sql,params});if(sql.startsWith('UPDATE users'))return{rows:[]};return{rows:[{id:9,username:'student.portal',role:'STUDENT',password_hash:'hash',session_version:1,email_verified:true,first_name:'Ana',last_name:'Montana'}]}}},comparePassword:async()=>true,jwtSecret:()=> 's'.repeat(48),issueToken:()=> 'student-token',auditSecurityEvent:async()=>true});
  const res=response();await controller.loginUser(requestFor('02000123456','UniquePass@1234'),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.token,'student-token');
  assert.equal(queries[0].params[0],'02000123456');
  assert.match(queries[0].sql,/s\.student_number=\$1/);
  assert.match(queries[0].sql,/u\.role='STUDENT'/);
});

test('administrator login auditing records outcomes without credentials',async()=>{
  const events=[];
  const controller=createAuthController({database:{async query(sql){return sql.startsWith('UPDATE users')?{rows:[]}:{rows:[{id:4,username:'sys.admin',role:'SYSTEM_ADMIN',password_hash:'private-hash',session_version:1}]}}},comparePassword:async()=>true,jwtSecret:()=> 's'.repeat(48),issueToken:()=> 'private-token',auditSecurityEvent:async(event)=>events.push(event)});
  const res=response();await controller.loginUser(requestFor('sys.admin','Private@123'),res);
  assert.equal(events[0].result,'SUCCESS');
  assert.equal(events[0].actor.role,'SYSTEM_ADMIN');
  assert.doesNotMatch(JSON.stringify(events),/Private@123|private-hash|private-token/);
});
