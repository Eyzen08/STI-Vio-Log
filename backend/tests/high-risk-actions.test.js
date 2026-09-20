const test=require('node:test');
const assert=require('node:assert/strict');
const {createHighRiskActionService}=require('../src/services/highRiskActionService');
const stubPool=(responses=[])=>{const calls=[];const query=async(sql,params=[])=>{calls.push({sql:String(sql),params});const next=responses.shift();return typeof next==='function'?next(sql,params):(next||{rows:[],rowCount:0})};return{calls,query,connect:async()=>({query,release(){}})}};

test('step-up tokens require the unified admin, bind the target version, expire quickly, and store only a hash',async()=>{
  const pool=stubPool([{rows:[{id:7,password_hash:'hash',role:'DISCIPLINE_ADMIN',is_active:true}]},{rows:[{id:12,username:'target',role:'DISCIPLINE_OFFICE',is_active:true,session_version:4}]},{rows:[],rowCount:1}]);
  const service=createHighRiskActionService({pool,comparePassword:async(value,hash)=>value==='correct'&&hash==='hash',randomBytes:()=>Buffer.from('single-use-secret')});
  const result=await service.verifyStepUp({userId:7,password:'correct',actionType:'ACCOUNT_LOCK',targetType:'USER_ACCOUNT',targetId:12});
  assert.equal(result.expires_in_seconds,300);assert.equal(pool.calls[2].params.includes(result.token),false);assert.match(pool.calls[2].params[1],/^[a-f0-9]{64}$/);assert.equal(pool.calls[2].params[5],'4');
});

test('retired System Administrator cannot receive a step-up token',async()=>{
  const pool=stubPool([{rows:[{id:7,password_hash:'hash',role:'SYSTEM_ADMIN',is_active:true}]}]);
  const service=createHighRiskActionService({pool,comparePassword:async()=>true});
  await assert.rejects(()=>service.verifyStepUp({userId:7,password:'correct',actionType:'ACCOUNT_LOCK',targetType:'USER_ACCOUNT',targetId:12}),error=>error.code==='INVALID_CREDENTIALS');
});

test('unknown direct actions are rejected before execution',async()=>{
  const service=createHighRiskActionService({pool:stubPool()});
  await assert.rejects(()=>service.executeDirect({requesterId:7,actionType:'ARBITRARY_SQL',targetId:12,reason:'A sufficiently clear reason',stepUpToken:'x'}),error=>error.code==='ACTION_NOT_REGISTERED');
});

test('direct execution consumes one bound token, checks target version, and records before and after state',async()=>{
  const target={id:12,username:'officer',role:'DISCIPLINE_OFFICE',is_active:true,session_version:4};
  const pool=stubPool([
    {rows:[target]}, {}, {rows:[{id:1,target_version:'4'}],rowCount:1}, {}, {}, {}, {rows:[target]},
    {rows:[{...target,is_active:false,session_version:5}]}, {}, {}, {rows:[{id:9,status:'EXECUTED'}]}
  ]);
  const service=createHighRiskActionService({pool});
  const result=await service.executeDirect({requesterId:7,actionType:'ACCOUNT_LOCK',targetId:12,reason:'Confirmed compromised account',stepUpToken:'bound-token'});
  assert.equal(result.request.status,'EXECUTED');assert.equal(result.result.is_active,false);
  const sql=pool.calls.map(call=>call.sql).join('\n');assert.match(sql,/consumed_at=CURRENT_TIMESTAMP/);assert.match(sql,/target_version/);assert.match(sql,/before_summary,after_summary/);
});
