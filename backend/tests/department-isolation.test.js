const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { recordTimeIn } = require('../src/services/communityServiceSessionService');
const { communityServiceTimeIn, getCommunityServiceAttendance } = require('../src/controllers/communityServiceAttendanceController');
const { createDepartmentAccountService } = require('../src/services/departmentAccountService');
const { createAccountAdministrationService } = require('../src/services/accountAdministrationService');

const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});

test('direct attendance rejects an assignment owned by another department before writing',async()=>{
  const originalConnect=pool.connect;const queries=[];
  pool.connect=async()=>({query:async(sql)=>{const text=String(sql);queries.push(text);if(text.includes('FROM community_service_assignments a'))return{rows:[{id:8,student_id:4,department_id:9,status:'OPEN',violation_status:'OPEN'}]};return{rows:[]}},release(){}});
  try{await assert.rejects(recordTimeIn({assignmentId:8,expectedStudentId:4,departmentId:10,actor:{id:3,role:'DEPARTMENT_HEAD'}}),(error)=>error.statusCode===404);assert.equal(queries.some(sql=>sql.includes('INSERT INTO community_service_attendance')),false)}finally{pool.connect=originalConnect}
});

test('Department Account attendance history is filtered by authenticated department',async()=>{
  const originalQuery=pool.query;let captured;
  pool.query=async(sql,params)=>{captured={sql:String(sql),params};return{rows:[]}};
  try{const res=response();await getCommunityServiceAttendance({user:{role:'DEPARTMENT_HEAD',department_id:7},params:{assignmentId:'8'}},res);assert.equal(res.statusCode,200);assert.match(captured.sql,/csa\.department_id = \$2 AND a\.department_id = \$2/);assert.deepEqual(captured.params,['8',7])}finally{pool.query=originalQuery}
});

test('Department Account cannot override its authenticated department in direct attendance',async()=>{
  const originalError=console.error;console.error=()=>{};
  try{const res=response();await communityServiceTimeIn({body:{assignment_id:8,student_id:4,department_id:10},user:{id:3,role:'DEPARTMENT_HEAD',department_id:7},staffDepartmentId:7,ip:'127.0.0.1'},res);assert.equal(res.statusCode,400);assert.match(res.body.message,/Unsupported field\(s\): department_id/)}finally{console.error=originalError}
});

test('Department Account creation requests transactional single-account enforcement',async()=>{
  let createInput;const service=createDepartmentAccountService({pool:{query:async(sql)=>String(sql).includes('FROM departments')?{rows:[{id:7,department_name:'Library Department'}]}:{rows:[]}},accountService:{list:async()=>({}),create:async(input)=>{createInput=input;return{account:{id:3}}},setStatus:async()=>({}),resetPassword:async()=>({})}});
  await service.create({actorId:1,username:'library.department',departmentId:7});assert.equal(createInput.enforceSingleDepartmentAccount,true);assert.equal(createInput.departmentId,7);
});

test('single Department Account creation takes a transaction-scoped department lock',async()=>{
  const queries=[];
  const client={query:async(sql)=>{const text=String(sql);queries.push(text);if(text.includes('SELECT 1 FROM users'))return{rows:[]};if(text.includes('SELECT id FROM departments'))return{rows:[{id:7}]};if(text.includes('INSERT INTO users'))return{rows:[{id:5,username:'library.department',role:'DEPARTMENT_HEAD',is_active:true,must_change_password:true,session_version:0,created_at:new Date()}]};return{rows:[]}},release(){}};
  const service=createAccountAdministrationService({pool:{connect:async()=>client},hashPassword:async()=> 'hashed',randomBytes:()=>Buffer.alloc(18,1)});
  await service.create({actorId:1,username:'library.department',role:'DEPARTMENT_HEAD',firstName:'Library',lastName:'Officer',departmentId:7,enforceSingleDepartmentAccount:true});
  assert.equal(queries.some(sql=>sql.includes('pg_advisory_xact_lock')),true);
  assert.equal(queries.some(sql=>sql.includes("u.role='DEPARTMENT_HEAD'")&&sql.includes('u.is_active=TRUE')),true);
});
