const test=require('node:test');
const assert=require('node:assert/strict');
const {createPasswordChangeService,passwordIsStrong}=require('../src/services/passwordChangeService');

const clientFor=(queries)=>({query:async(sql,params)=>{queries.push({sql:String(sql),params});if(String(sql).includes('SELECT id,username'))return{rows:[{id:3,username:'officer',role:'DISCIPLINE_OFFICE',password_hash:'old-hash',session_version:4}]};if(String(sql).includes('UPDATE users'))return{rows:[{id:3,username:'officer',role:'DISCIPLINE_OFFICE',session_version:5,must_change_password:false}]};return{rows:[]}},release(){}});

test('password policy requires length and mixed character classes',()=>{assert.equal(passwordIsStrong('Short1!'),false);assert.equal(passwordIsStrong('LongSecure1!pass'),true)});

test('password change verifies current credential, rotates session version, and audits without plaintext',async()=>{
  const queries=[];const client=clientFor(queries);const service=createPasswordChangeService({pool:{connect:async()=>client},comparePassword:async(value,hash)=>value==='current-password'&&hash==='old-hash',hashPassword:async()=> 'new-hash',issueToken:(user)=>`session-${user.session_version}`});
  const result=await service.change({userId:3,currentPassword:'current-password',newPassword:'NewSecure1!pass',ipAddress:'127.0.0.1'});
  assert.equal(result.token,'session-5');assert.equal(result.user.password_change_required,false);
  assert(queries.some(({sql})=>sql.includes('session_version=session_version+1')));
  assert.equal(JSON.stringify(queries).includes('NewSecure1!pass'),false);
});
