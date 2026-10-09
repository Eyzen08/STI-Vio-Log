const test = require('node:test');
const assert = require('node:assert/strict');
const { passwordIsStrong, passwordRequirements } = require('../src/services/passwordPolicy');
const { secureOtp, hashSecret, createOtpService } = require('../src/services/otpService');
const { STUDENT_NUMBER_PATTERN, EMAIL_PATTERN, REGISTRATION_TTL_HOURS, normalizeName, splitName, expirePendingRegistration } = require('../src/services/studentPasswordAuthService');
const { createStudentPasswordAuthService } = require('../src/services/studentPasswordAuthService');
const { createStudentPasswordAuthController } = require('../src/controllers/studentPasswordAuthController');

test('registration rejects malformed names and unsupported suffixes before database access', async()=>{
  const service=createStudentPasswordAuthService({pool:{connect:async()=>{throw Error('Invalid registration must not access records')}},otpService:{}});
  const base={firstName:'Juan',lastName:'Reyes',guardianName:'Maria Reyes'};
  for(const [field,value] of [['firstName','Juan3'],['middleName','---'],['lastName','@Reyes'],['suffix','XI'],['guardianName','123']]) await assert.rejects(service.register({...base,[field]:value}),error=>error.code==='VALIDATION_ERROR');
});

const setResetSigningKey = (t) => {
  const previous = process.env.OTP_HASH_KEY;
  process.env.OTP_HASH_KEY = 'test-only-reset-signing-key'.repeat(2);
  t.after(() => {
    if (previous === undefined) delete process.env.OTP_HASH_KEY;
    else process.env.OTP_HASH_KEY = previous;
  });
};

test('student number and email validation follow the registration contract', () => {
  assert.equal(REGISTRATION_TTL_HOURS,24);
  assert.equal(STUDENT_NUMBER_PATTERN.test('02000123456'), true);
  assert.equal(STUDENT_NUMBER_PATTERN.test('12000123456'), true);
  for (const invalid of ['0200012345','120001234567','02000ABCDEF',' 02000123456 ']) assert.equal(STUDENT_NUMBER_PATTERN.test(invalid), false);
  assert.equal(EMAIL_PATTERN.test('student@example.com'), true);
  assert.equal(EMAIL_PATTERN.test('student@'), false);
});

test('pending password registrations expire after 24 hours and clear their duplicate password hash',async()=>{
  const calls=[];
  const database={async query(sql,params){calls.push({sql:String(sql),params});return{rows:[],rowCount:1}}};
  await expirePendingRegistration(database,7);
  assert.match(calls[0].sql,/status='EXPIRED'/);
  assert.match(calls[0].sql,/password_hash=NULL/);
  assert.match(calls[0].sql,/INTERVAL '24 hours'/);
  assert.deepEqual(calls[0].params,[7]);
});

test('shared password policy enforces every required class', () => {
  assert.equal(passwordIsStrong('UniquePass@1234'), true);
  assert.equal(passwordIsStrong('short1!'), false);
  assert.equal(passwordIsStrong('password@123'), false);
  assert.equal(passwordIsStrong('Password@Test'), false);
  assert.equal(passwordIsStrong('Password123'), false);
  assert.deepEqual(passwordRequirements('UniquePass@1234'), {length:true,uppercase:true,number:true,special:true,uncommon:true});
});

test('shared password policy accepts 8-128 characters without relaxing complexity', () => {
  for (const length of [7,8,9,11,12,128,129]) {
    const password = 'Aa1!' + 'x'.repeat(length - 4);
    const accepted = length >= 8 && length <= 128;
    assert.equal(passwordRequirements(password).length, accepted, `length ${length}`);
    assert.equal(passwordIsStrong(password), accepted, `length ${length}`);
  }
  for (const password of ['aa1!xxxx','Aaaa!xxx','Aaa1xxxx','Admin123!']) {
    assert.equal(passwordRequirements(password).length, true);
    assert.equal(passwordIsStrong(password), false, password);
  }
});

test('registration rejects 7 characters and accepts 8 and 9 while requiring email verification', async () => {
  const base = {firstName:'Jose',lastName:'Reyes',studentNumber:'02000123456',email:'student@example.test',phoneNumber:'09171234567',program:'BSIT',section:'A103',yearLevel:2,guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567'};
  for (const length of [7,8,9]) {
    const password = 'Aa1!' + 'x'.repeat(length - 4);
    const queries = [], hashed = [], issued = [];
    const client = {
      async query(sql, params) {
        queries.push({sql:String(sql),params});
        if (String(sql).includes('INSERT INTO student_account_registrations')) return {rows:[{id:7,email:base.email}]};
        return {rows:[]};
      },
      release() {}
    };
    const service = createStudentPasswordAuthService({
      pool:{connect:async()=>client},
      hashPassword:async(value)=>{hashed.push(value);return 'safe-hash';},
      otpService:{issue:async(input)=>{issued.push(input);}}
    });
    const action = service.register({...base,password,confirmPassword:password});
    if (length === 7) {
      await assert.rejects(action, error=>error.code==='WEAK_PASSWORD' && /at least 8 characters/.test(error.message));
      assert.deepEqual(queries, []);
      assert.deepEqual(hashed, []);
      assert.deepEqual(issued, []);
    } else {
      assert.deepEqual(await action, {registration_id:7,email:base.email});
      assert.deepEqual(hashed, [password]);
      assert.deepEqual(issued, [{purpose:'STUDENT_EMAIL_VERIFICATION',registrationId:7,email:base.email}]);
      assert(queries.some(({sql,params})=>sql.includes('INSERT INTO student_account_registrations') && params[3]==='safe-hash'));
      assert.equal(queries.some(({sql})=>sql.includes('INSERT INTO users')), false);
      assert.equal(queries.at(-1).sql, 'COMMIT');
      assert.equal(JSON.stringify(queries).includes(password), false);
    }
  }
});

test('Student and administrator resets enforce the new minimum and consume authorization', async (t) => {
  setResetSigningKey(t);
  for (const role of ['STUDENT','DISCIPLINE_ADMIN']) {
    for (const length of [7,8,9]) {
      const newPassword = 'Aa1!' + 'x'.repeat(length - 4);
      const queries = [], hashed = [];
      const client = {
        async query(sql, params) {
          queries.push({sql:String(sql),params});
          if (String(sql).includes('SELECT * FROM password_reset_authorizations')) return {rows:[{id:7,user_id:3}]};
          if (String(sql).includes('SELECT password_hash,role')) return {rows:[{password_hash:'old-hash',role}]};
          return {rows:[]};
        },
        release() {}
      };
      const service = createStudentPasswordAuthService({
        pool:{connect:async()=>client},otpService:{},comparePassword:async()=>false,
        hashPassword:async(value)=>{hashed.push(value);return 'safe-hash';}
      });
      const action = service.resetPassword({resetToken:'reset-token',newPassword,confirmPassword:newPassword});
      if (length === 7) {
        await assert.rejects(action, error=>error.code==='WEAK_PASSWORD' && /at least 8 characters/.test(error.message));
        assert.deepEqual(queries, []);
        assert.deepEqual(hashed, []);
      } else {
        await action;
        assert.deepEqual(hashed, [newPassword]);
        assert(queries.some(({sql})=>sql.includes('used_at IS NULL AND expires_at>CURRENT_TIMESTAMP')));
        assert(queries.some(({sql,params})=>sql.includes('UPDATE users') && sql.includes('session_version=session_version+1') && sql.includes('must_change_password=FALSE') && params[1]==='safe-hash'));
        assert(queries.some(({sql,params})=>sql.includes('UPDATE password_reset_authorizations SET used_at') && params[0]===7));
        assert(queries.some(({sql,params})=>sql.includes('INSERT INTO audit_logs') && params[1]===(role==='STUDENT'?'STUDENT_PASSWORD_RESET':'ADMIN_PASSWORD_RESET')));
        assert.equal(queries.at(-1).sql, 'COMMIT');
        assert.equal(JSON.stringify(queries).includes(newPassword), false);
      }
    }
  }
});

test('8-character resets still reject invalid authorization and password reuse', async (t) => {
  setResetSigningKey(t);
  for (const code of ['RESET_AUTHORIZATION_INVALID','PASSWORD_REUSE']) {
    const queries = [];
    const client = {
      async query(sql) {
        queries.push(String(sql));
        if (String(sql).includes('SELECT * FROM password_reset_authorizations')) return {rows:code==='RESET_AUTHORIZATION_INVALID'?[]:[{id:7,user_id:3}]};
        if (String(sql).includes('SELECT password_hash,role')) return {rows:[{password_hash:'old-hash',role:'STUDENT'}]};
        return {rows:[]};
      },
      release() {}
    };
    const service = createStudentPasswordAuthService({pool:{connect:async()=>client},otpService:{},comparePassword:async()=>true,hashPassword:async()=>assert.fail('Rejected reset must not hash a password')});
    await assert.rejects(service.resetPassword({resetToken:'reset-token',newPassword:'Aa1!xxxx',confirmPassword:'Aa1!xxxx'}), error=>error.code===code);
    assert.equal(queries.some(sql=>sql.startsWith('UPDATE ')), false);
    assert.equal(queries.at(-1), 'ROLLBACK');
  }
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
  const base={firstName:'Jose',middleName:'Pedro',lastName:'Reyes',suffix:'',studentNumber:'02000123456',email:'student@example.test',phoneNumber:'09171234567',program:'BSIT',section:'A103',yearLevel:2,guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567',password:'UniquePass@1234',confirmPassword:'UniquePass@1234'};
  for(const override of [{studentNumber:'123'},{email:'bad-email'},{phoneNumber:'12'},{yearLevel:0},{guardianName:''},{password:'weak',confirmPassword:'weak'},{confirmPassword:'Different@123'}, {firstName:''},{lastName:''}])await assert.rejects(service.register({...base,...override}));
});

test('registration controller maps complete student and guardian information only',async()=>{
  let received;
  const controller=createStudentPasswordAuthController({service:{async register(input){received=input;return{registration_id:7,email:input.email}}}});
  const body={full_name:'Jose Pedro Reyes',first_name:'Jose',middle_name:'Pedro',last_name:'Reyes',suffix:'',student_number:'02000123456',email:'student@example.test',phone_number:'09171234567',program:'BSIT',section:'A103',year_level:2,guardian_name:'Maria Reyes',guardian_relationship:'Mother',guardian_phone_number:'09181234567',password:'UniquePass@1234',confirm_password:'UniquePass@1234'};
  const response={statusCode:0,payload:null,status(code){this.statusCode=code;return this},json(value){this.payload=value;return this}};
  await controller.register({body},response);
  assert.equal(response.statusCode,202);
  assert.deepEqual(received,{fullName:body.full_name,firstName:body.first_name,middleName:body.middle_name,lastName:body.last_name,suffix:body.suffix,studentNumber:body.student_number,email:body.email,phoneNumber:body.phone_number,academicLevel:body.academic_level,strand:body.strand,program:body.program,section:body.section,yearLevel:body.year_level,guardianName:body.guardian_name,guardianRelationship:body.guardian_relationship,guardianPhoneNumber:body.guardian_phone_number,password:body.password,confirmPassword:body.confirm_password});
});
