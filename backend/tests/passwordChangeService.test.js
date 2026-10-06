const test=require('node:test');
const assert=require('node:assert/strict');
const {createPasswordChangeService,passwordIsStrong}=require('../src/services/passwordChangeService');

const clientFor=(queries)=>({query:async(sql,params)=>{queries.push({sql:String(sql),params});if(String(sql).includes('u.password_hash'))return{rows:[{id:3,username:'officer',role:'DISCIPLINE_OFFICE',password_hash:'old-hash',session_version:4,first_name:'Pedro',last_name:'Makisig'}]};if(String(sql).includes('UPDATE users'))return{rows:[{id:3,username:'officer',role:'DISCIPLINE_OFFICE',session_version:5,must_change_password:false}]};return{rows:[]}},release(){}});

test('password policy requires length and mixed character classes',()=>{assert.equal(passwordIsStrong('Short1!'),false);assert.equal(passwordIsStrong('LongSecure1!pass'),true)});

test('password change verifies current credential, rotates session version, and audits without plaintext',async(t)=>{
 for(const newPassword of ['Aa1!xxxx','Aa1!xxxxx','NewSecure1!pass'])await t.test(`${newPassword.length}-character password`,async()=>{
  const queries=[];const hashed=[];const client=clientFor(queries);const service=createPasswordChangeService({pool:{connect:async()=>client},comparePassword:async(value,hash)=>value==='current-password'&&hash==='old-hash',hashPassword:async(value)=>{hashed.push(value);return 'new-hash'},issueToken:(user)=>`session-${user.session_version}`});
  const result=await service.change({userId:3,currentPassword:'current-password',newPassword,ipAddress:'127.0.0.1'});
  assert.equal(result.token,'session-5');assert.deepEqual(result.user,{avatar:undefined,id:3,username:'officer',role:'DISCIPLINE_OFFICE',first_name:'Pedro',last_name:'Makisig',full_name:'Pedro Makisig',password_change_required:false,onboarding_required:false,onboarding_step:'COMPLETE'});
  assert(queries.some(({sql})=>sql.includes('session_version=session_version+1')));
  assert.deepEqual(hashed,[newPassword]);
  assert(queries.some(({sql})=>sql.includes('must_change_password=FALSE')));
  assert.equal(JSON.stringify(queries).includes(newPassword),false);
 });
});

test('7-character password changes are rejected before database access or hashing',async()=>{
  const service=createPasswordChangeService({pool:{connect:async()=>assert.fail('Short password must not reach the database')},hashPassword:async()=>assert.fail('Short password must not be hashed')});
  await assert.rejects(service.change({userId:3,currentPassword:'current-password',newPassword:'Aa1!xxx'}),error=>error.code==='VALIDATION_ERROR'&&/8-128/.test(error.message));
});

test('8-character password changes still verify the current password and reject reuse',async()=>{
  for(const code of ['INVALID_CREDENTIALS','PASSWORD_REUSE']){
    const queries=[];const client=clientFor(queries);
    const service=createPasswordChangeService({pool:{connect:async()=>client},comparePassword:async()=>code==='PASSWORD_REUSE',hashPassword:async()=>assert.fail('Rejected change must not hash a password')});
    await assert.rejects(service.change({userId:3,currentPassword:'current-password',newPassword:'Aa1!xxxx'}),error=>error.code===code);
    assert.equal(queries.some(({sql})=>sql.startsWith('UPDATE ')),false);
    assert.equal(queries.at(-1).sql,'ROLLBACK');
  }
});
