const test = require('node:test');
const assert = require('node:assert/strict');
const { passwordIsStrong, passwordRequirements } = require('../src/services/passwordPolicy');
const { secureOtp, hashSecret, createOtpService } = require('../src/services/otpService');
const { STUDENT_NUMBER_PATTERN, EMAIL_PATTERN, normalizeName, splitName } = require('../src/services/studentPasswordAuthService');
const { createStudentPasswordAuthService } = require('../src/services/studentPasswordAuthService');

test('student number and email validation follow the registration contract', () => {
  assert.equal(STUDENT_NUMBER_PATTERN.test('02000123456'), true);
  assert.equal(STUDENT_NUMBER_PATTERN.test('12000123456'), true);
  for (const invalid of ['0200012345','120001234567','02000ABCDEF',' 02000123456 ']) assert.equal(STUDENT_NUMBER_PATTERN.test(invalid), false);
  assert.equal(EMAIL_PATTERN.test('student@example.com'), true);
  assert.equal(EMAIL_PATTERN.test('student@'), false);
});

test('shared password policy enforces every required class', () => {
  assert.equal(passwordIsStrong('Password@123'), true);
  assert.equal(passwordIsStrong('short1!'), false);
  assert.equal(passwordIsStrong('password@123'), false);
  assert.equal(passwordIsStrong('Password@Test'), false);
  assert.equal(passwordIsStrong('Password123'), false);
  assert.deepEqual(passwordRequirements('Password@123'), {length:true,uppercase:true,number:true,special:true});
});

test('OTP generation is six digits and hashing does not expose the code', () => {
  for(let index=0;index<20;index+=1) assert.match(secureOtp(), /^\d{6}$/);
  const digest=hashSecret('123456','s'.repeat(48));
  assert.equal(digest.length,64);
  assert.equal(digest.includes('123456'),false);
});

test('name normalization supports safe school-record comparison and profile splitting', () => {
  assert.equal(normalizeName(' José   Pedro-Reyes '),normalizeName('JOSÉ PEDRO REYES'));
  assert.deepEqual(splitName('Jose Pedro Reyes'),{firstName:'Jose Pedro',lastName:'Reyes'});
});

test('incorrect OTP increments attempts and does not mark the code used', async () => {
  const queries=[];
  const client={async query(sql,params){queries.push({sql:String(sql),params});if(String(sql).includes('SELECT * FROM auth_otps'))return{rows:[{id:7,otp_hash:hashSecret('123456','s'.repeat(48)),attempt_count:0,expires_at:new Date(Date.now()+60_000)}]};return{rows:[]}},release(){}};
  const service=createOtpService({pool:{connect:async()=>client},sendOtp:async()=>{},hash:(value)=>hashSecret(value,'s'.repeat(48))});
  await assert.rejects(service.verify({purpose:'STUDENT_PASSWORD_RESET',userId:2,code:'654321',client}),error=>error.code==='OTP_INVALID_OR_EXPIRED');
  assert(queries.some(({sql})=>sql.includes('attempt_count=attempt_count+1')));
  assert.equal(queries.some(({sql})=>sql.includes('SET used_at')&&sql.includes('WHERE id')),false);
});

test('forgot-password service hides account existence and delivery failures',async()=>{
  let rows=[{id:4,email:'student@example.test'}];
  const pool={async query(){return{rows}},connect:async()=>({})};
  const otpService={async issue(){throw Object.assign(new Error('SMTP down'),{code:'EMAIL_UNAVAILABLE'})}};
  const service=createStudentPasswordAuthService({pool,otpService});
  assert.equal(await service.requestPasswordReset({identifier:'02000123456'}),undefined);
  rows=[];
  assert.equal(await service.requestPasswordReset({identifier:'unknown'}),undefined);
});

test('expired, missing, and attempt-limited OTPs are rejected',async()=>{
  const scenarios=[[],[{id:1,otp_hash:hashSecret('123456','s'.repeat(48)),attempt_count:0,expires_at:new Date(Date.now()-1000)}],[{id:1,otp_hash:hashSecret('123456','s'.repeat(48)),attempt_count:5,expires_at:new Date(Date.now()+60_000)}]];
  for(const rows of scenarios){const client={async query(sql){if(String(sql).includes('SELECT * FROM auth_otps'))return{rows};return{rows:[]}}};const service=createOtpService({pool:{connect:async()=>client},sendOtp:async()=>{},hash:value=>hashSecret(value,'s'.repeat(48))});await assert.rejects(service.verify({purpose:'STUDENT_PASSWORD_RESET',userId:2,code:'123456',client}));}
});

test('correct OTP is consumed exactly once',async()=>{
  const queries=[];const row={id:3,otp_hash:hashSecret('123456','s'.repeat(48)),attempt_count:0,expires_at:new Date(Date.now()+60_000)};
  const client={async query(sql){queries.push(String(sql));if(String(sql).includes('SELECT * FROM auth_otps'))return{rows:[row]};return{rows:[]}}};
  const service=createOtpService({pool:{connect:async()=>client},sendOtp:async()=>{},hash:value=>hashSecret(value,'s'.repeat(48))});
  await service.verify({purpose:'STUDENT_PASSWORD_RESET',userId:2,code:'123456',client});
  assert(queries.some(sql=>sql.includes('SET used_at=CURRENT_TIMESTAMP')));
});

test('invalid registrations are rejected before any database mutation',async()=>{
  const pool={connect:async()=>{throw new Error('database must not be reached')}};
  const service=createStudentPasswordAuthService({pool,otpService:{issue:async()=>{}}});
  const base={fullName:'Jose Reyes',studentNumber:'02000123456',email:'student@example.test',password:'Password@123',confirmPassword:'Password@123'};
  for(const override of [{studentNumber:'123'},{email:'bad-email'},{password:'weak',confirmPassword:'weak'},{confirmPassword:'Different@123'}, {fullName:''}])await assert.rejects(service.register({...base,...override}));
});
