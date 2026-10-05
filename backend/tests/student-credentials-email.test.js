const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createStudentCredentialsEmailController } = require('../src/controllers/studentController');

const password = 'Current-test-password!Aa1';
const passwordHash = bcrypt.hashSync(password, 4);
const account = { id:55, username:'02000123456', email:'student@gmail.com', first_name:'Test', last_name:'Student', password_hash:passwordHash, is_active:true, must_change_password:true, onboarding_required:true, onboarding_completed_at:null };
const response = () => ({ statusCode:200, body:null, headers:{}, set(key,value){this.headers[key]=value}, status(code){this.statusCode=code;return this}, json(body){this.body=body;return this} });

const setup = ({ row=account, fail=false } = {}) => {
  const calls=[];
  const messages=[];
  let released=false;
  const handler=createStudentCredentialsEmailController({
    db:{async connect(){return {async query(sql,params){calls.push({sql,params});return{rows:sql.includes('FROM students s JOIN users')?(row?[row]:[]):[]}},release(){released=true}}}},
    emailService:{async sendStudentCredentials(message){messages.push(message);if(fail)throw Object.assign(new Error(`Secret provider error ${password}`),{code:'EMAIL_DELIVERY_FAILED'})}}
  });
  const request=(body={temporary_password:password},id='55')=>({user:{id:1},params:{id},body,ip:'127.0.0.1'});
  return {handler,calls,messages,request,get released(){return released}};
};

test('manual credential email uses the saved recipient, current username and verified password',async()=>{
  const fixture=setup();const res=response();
  await fixture.handler(fixture.request(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.email_status,'sent');
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.deepEqual(fixture.messages,[{to:'student@gmail.com',studentName:'Test Student',studentNumber:'02000123456',temporaryPassword:password}]);
  const audit=fixture.calls.find(({sql})=>sql.includes('INSERT INTO audit_logs'));
  assert.equal(audit.params[1],'STUDENT_CREDENTIALS_EMAIL_SENT');
  assert(!JSON.stringify(audit).includes(password));
  assert(!JSON.stringify(res.body).includes(password));
  assert.equal(fixture.calls.at(-1).sql,'COMMIT');
  assert.equal(fixture.released,true);
});

test('invalid, overwritten, or bcrypt-truncated credentials cannot be emailed',async()=>{
  for(const body of [{}, {temporary_password:123}, {temporary_password:'wrong-password'}, {temporary_password:password+'x'.repeat(80)}, {temporary_password:password,email:'attacker@gmail.com'}]){
    const fixture=setup();const res=response();
    await fixture.handler(fixture.request(body),res);
    assert([400,409].includes(res.statusCode));
    assert.equal(fixture.messages.length,0);
  }
  const fixture=setup();const res=response();
  await fixture.handler(fixture.request({temporary_password:password},'invalid'),res);
  assert.equal(res.statusCode,400);
  assert.equal(fixture.calls.length,0);
});

test('inactive accounts, changed passwords, completed onboarding, and invalid saved Gmail are rejected',async()=>{
  for(const change of [{is_active:false},{must_change_password:false},{onboarding_required:false},{onboarding_completed_at:new Date()},{email:null},{email:'student@yahoo.com'},{password_hash:null}]){
    const fixture=setup({row:{...account,...change}});const res=response();
    await fixture.handler(fixture.request(),res);
    assert.equal(res.statusCode,409,JSON.stringify(change));
    assert.equal(fixture.messages.length,0);
    assert.equal(fixture.calls.at(-1).sql,'ROLLBACK');
    assert.equal(fixture.released,true);
  }
  const fixture=setup({row:null});const res=response();
  await fixture.handler(fixture.request(),res);
  assert.equal(res.statusCode,404);
});

test('email failure is audited without secrets and preserves account credentials for retry',async()=>{
  const fixture=setup({fail:true});const res=response();
  await fixture.handler(fixture.request(),res);
  assert.equal(res.statusCode,503);
  assert.match(res.body.message,/Account created, but email could not be sent/);
  assert(!JSON.stringify(res.body).includes(password));
  assert.equal(fixture.calls.find(({sql})=>sql.includes('INSERT INTO audit_logs')).params[1],'STUDENT_CREDENTIALS_EMAIL_FAILED');
  assert(!JSON.stringify(fixture.calls).includes(password));
  assert(!fixture.calls.some(({sql})=>/UPDATE|DELETE/.test(sql.replace('FOR UPDATE OF s,u',''))));
  assert.equal(fixture.calls.at(-1).sql,'COMMIT');
  const retry=setup();const retryResponse=response();
  await retry.handler(retry.request(),retryResponse);
  assert.equal(retryResponse.statusCode,200);
});
