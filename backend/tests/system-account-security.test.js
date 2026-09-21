const test=require('node:test');
const assert=require('node:assert/strict');
const {createSystemAccountSecurityService}=require('../src/services/systemAccountSecurityService');

const fakePool=(target,{activeCount=2}={})=>{
  const queries=[];
  const client={async query(sql,params=[]){queries.push({sql:String(sql),params});if(String(sql).startsWith('SELECT id,username,role,is_active'))return{rows:[target]};if(String(sql).includes('COUNT(*)'))return{rows:[{count:activeCount}]};if(String(sql).startsWith('UPDATE users')&&String(sql).includes('RETURNING'))return{rows:[{...target,is_active:String(sql).includes('is_active=TRUE'),must_change_password:String(sql).includes('must_change_password=TRUE'),session_version:4}]};return{rows:[]}},release(){}};
  return{queries,pool:{connect:async()=>client}};
};

test('system account lock is concurrency guarded, audited, and invalidates sessions',async()=>{
  const fake=fakePool({id:8,username:'compromised',role:'DISCIPLINE_OFFICE',is_active:true});
  const result=await createSystemAccountSecurityService({pool:fake.pool}).lock({actorId:2,targetId:8,reason:'Confirmed compromised credentials'});
  assert.equal(result.is_active,false);
  const sql=fake.queries.map(({sql})=>sql).join('\n');
  assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/session_version=session_version\+1/);assert.match(sql,/ACCOUNT_LOCK/);
});

test('system account lock rejects self-lock and the final active administrator',async()=>{
  const service=createSystemAccountSecurityService({pool:fakePool({id:8,username:'admin',role:'DISCIPLINE_ADMIN',is_active:true},{activeCount:1}).pool});
  await assert.rejects(()=>service.lock({actorId:8,targetId:8,reason:'Attempt to lock own account'}),(error)=>error.code==='SELF_ACCOUNT_CHANGE');
  await assert.rejects(()=>service.lock({actorId:2,targetId:8,reason:'Attempt to lock final admin'}),(error)=>error.code==='LAST_ADMIN');
});

test('controlled recovery supports students, returns a credential once, and reports the complete new state',async()=>{
  const fake=fakePool({id:8,username:'student-one',role:'STUDENT',is_active:false,must_change_password:false,session_version:3});
  const recovery=await createSystemAccountSecurityService({pool:fake.pool,hashPassword:async()=> 'secure-hash',randomBytes:()=>Buffer.from('abcdefghijklmnopqr')}).initiateRecovery({actorId:2,targetId:8,reason:'Verified recovery request INC-8'});
  assert.match(recovery.temporary_password,/!Aa1$/);
  assert.equal(recovery.account.role,'STUDENT');assert.equal(recovery.account.is_active,true);assert.equal(recovery.account.must_change_password,true);assert.equal(recovery.account.session_version,4);
  const joined=fake.queries.map(({sql,params})=>`${sql} ${JSON.stringify(params)}`).join('\n');
  assert.match(joined,/must_change_password=TRUE/);assert.match(joined,/session_version=session_version\+1/);assert.match(joined,/ACCOUNT_RECOVERY_INITIATED/);assert.doesNotMatch(joined,new RegExp(recovery.temporary_password));
  assert.doesNotMatch(joined,/role<>/);
});
