const test=require('node:test');
const assert=require('node:assert/strict');
const {createStudentOnboardingService,onboardingState}=require('../src/services/studentOnboardingService');
const {createGoogleIdentityService}=require('../src/services/googleIdentityService');
const {createStudentOnboardingController}=require('../src/controllers/accountController');

const fakePool=(handler)=>{const calls=[];const client={async query(sql,params=[]){calls.push({sql:String(sql),params});return handler(String(sql),params)},release(){}};return{calls,pool:{connect:async()=>client}}};

test('onboarding completion writes no official profile fields and only marks the review complete',async()=>{
  const db=fakePool((sql)=>{
    if(sql.includes('FROM students s JOIN users'))return{rows:[{id:9,onboarding_required:true,onboarding_completed_at:null,must_change_password:false,google_linked:true}]};
    return{rows:[]};
  });
  const service=createStudentOnboardingService({pool:db.pool});
  const result=await service.completeProfile({userId:8,ipAddress:'127.0.0.1'});
  assert.deepEqual(result,{onboarding_required:false,onboarding_step:'COMPLETE'});
  assert(db.calls.some(({sql})=>sql.includes('onboarding_completed_at=CURRENT_TIMESTAMP')));
  assert(db.calls.some(({sql})=>sql.includes("'STUDENT_ONBOARDING_COMPLETE'")));
  assert(db.calls.some(({sql})=>sql==='COMMIT'));
  for(const field of ['UPDATE students SET academic_level','phone_number','guardian_name','guardian_relationship','student_guardians','program=','section=']){
    assert.equal(db.calls.some(({sql})=>sql.includes(field)),false,field);
  }
});

test('onboarding state advances through password, Google, profile, and completion',()=>{
  const base={role:'STUDENT',onboarding_required:true,onboarding_completed_at:null};
  assert.deepEqual(onboardingState({...base,must_change_password:true,google_linked:false}),{onboarding_required:true,onboarding_step:'PASSWORD'});
  assert.deepEqual(onboardingState({...base,must_change_password:false,google_linked:false}),{onboarding_required:true,onboarding_step:'GOOGLE',google_onboarding_stage:'EMAIL',onboarding_google_email:null});
  assert.equal(onboardingState({...base,must_change_password:false,google_linked:false,pending_google_email:'student@example.com'}).google_onboarding_stage,'OTP');
  assert.equal(onboardingState({...base,must_change_password:false,google_linked:false,pending_google_email:'student@example.com',pending_google_email_verified_at:new Date()}).google_onboarding_stage,'OAUTH');
  assert.deepEqual(onboardingState({...base,must_change_password:false,google_linked:true}),{onboarding_required:true,onboarding_step:'PROFILE'});
  assert.deepEqual(onboardingState({...base,onboarding_completed_at:new Date(),google_linked:true}),{onboarding_required:false,onboarding_step:'COMPLETE'});
});

test('authenticated Google binding verifies email and establishes recovery address',async()=>{
  const db=fakePool((sql)=>{
    if(sql.includes('FROM users u JOIN students'))return{rows:[{id:8,username:'02000123456',role:'STUDENT',session_version:2,must_change_password:false,student_id:9,first_name:'Ana',last_name:'Reyes',onboarding_required:true,onboarding_completed_at:null,email:'ana@gmail.com',pending_google_email:'ana@gmail.com',pending_google_email_verified_at:new Date(),google_linked:false}]};
    if(sql.startsWith('SELECT id,user_id,google_subject'))return{rows:[]};
    if(sql.startsWith('INSERT INTO google_identity_links'))return{rows:[{id:17}]};
    return{rows:[]};
  });
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'private-subject',email:'ana@gmail.com',emailVerified:true}),issueToken:()=>null});
  const result=await service.linkAuthenticatedStudent({userId:8,credential:'private-token'});
  assert.equal(result.user.onboarding_step,'PROFILE');
  assert(db.calls.some(({sql,params})=>sql.startsWith('UPDATE students SET email=')&&params.includes('ana@gmail.com')));
  assert(db.calls.some(({sql})=>sql.includes('email_verified=TRUE')));
  assert(db.calls.some(({sql})=>sql.includes('pending_google_email=NULL')));
  assert.equal(db.calls.some(({sql,params})=>sql.includes('private-token')||params.includes('private-token')),false);
  assert.equal(db.calls.some(({sql})=>sql.includes('private-subject')&&sql.includes('audit_logs')),false);
});

test('onboarding email OTP is normalized, persisted, and required before OAuth',async()=>{
  let issued;const db=fakePool((sql)=>sql.includes('FROM students s JOIN users')?{rows:[{id:9,user_id:8,role:'STUDENT',must_change_password:false,onboarding_required:true,onboarding_completed_at:null,google_linked:false,email:'student@gmail.com',pending_google_email:null,pending_google_email_verified_at:null}]}:{rows:[]});
  const otp={issue:async(input)=>{issued=input},verify:async(input)=>{assert.equal(input.email,'student@gmail.com');assert.equal(input.code,'123456')}};
  const service=createStudentOnboardingService({pool:db.pool,otpService:otp});
  const requested=await service.requestGoogleEmail({userId:8,email:' Student@Gmail.com '});
  assert.equal(requested.google_onboarding_stage,'OTP');assert.equal(issued.email,'student@gmail.com');
  db.pool.connect=async()=>({async query(sql,params=[]){db.calls.push({sql:String(sql),params});if(String(sql).includes('FROM students s JOIN users'))return{rows:[{id:9,user_id:8,role:'STUDENT',must_change_password:false,onboarding_required:true,onboarding_completed_at:null,google_linked:false,email:'student@gmail.com',pending_google_email:'student@gmail.com',pending_google_email_verified_at:null}]};return{rows:[]}},release(){}});
  const verified=await service.verifyGoogleEmail({userId:8,code:'123456'});
  assert.equal(verified.google_onboarding_stage,'OAUTH');assert(db.calls.some(({sql})=>sql.includes('pending_google_email_verified_at=CURRENT_TIMESTAMP')));
});

test('authenticated Google binding rejects an unverified email before database access',async()=>{
  const db=fakePool(()=>({rows:[]}));
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'subject',email:'student@gmail.com',emailVerified:false}),issueToken:()=>null});
  await assert.rejects(service.linkAuthenticatedStudent({userId:8,credential:'token'}),(error)=>error.code==='GOOGLE_EMAIL_UNVERIFIED');
  assert.equal(db.calls.length,0);
});

test('authenticated Google binding rejects an OAuth email that differs from the OTP-confirmed address',async()=>{
  const db=fakePool((sql)=>sql.includes('FROM users u JOIN students')?{rows:[{id:8,role:'STUDENT',must_change_password:false,student_id:9,onboarding_required:true,onboarding_completed_at:null,pending_google_email:'confirmed@school.edu',pending_google_email_verified_at:new Date(),google_linked:false}]}:{rows:[]});
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'private-subject',email:'different@gmail.com',emailVerified:true}),issueToken:()=>null});
  await assert.rejects(service.linkAuthenticatedStudent({userId:8,credential:'private-token'}),(error)=>error.code==='GOOGLE_EMAIL_MISMATCH');
  assert.equal(db.calls.some(({sql})=>sql.startsWith('INSERT INTO google_identity_links')),false);
  assert.equal(db.calls.some(({sql,params})=>sql.includes('audit_logs')&&params.includes('private-subject')),false);
});

test('onboarding completion requires a changed password and a linked Google account',async()=>{
  const cases=[
    [{onboarding_required:true,onboarding_completed_at:null,must_change_password:true,google_linked:false},'PASSWORD_CHANGE_REQUIRED'],
    [{onboarding_required:true,onboarding_completed_at:null,must_change_password:false,google_linked:false},'STUDENT_ONBOARDING_REQUIRED']
  ];
  for(const [row,code] of cases){
    const db=fakePool((sql)=>sql.includes('FROM students s JOIN users')?{rows:[{id:9,...row}]}:{rows:[]});
    const service=createStudentOnboardingService({pool:db.pool});
    await assert.rejects(service.completeProfile({userId:8}),(error)=>error.code===code);
    assert.equal(db.calls.some(({sql})=>sql.includes('UPDATE students SET onboarding_required=FALSE')),false);
    assert(db.calls.some(({sql})=>sql==='ROLLBACK'));
  }
  const missing=fakePool(()=>({rows:[]}));
  const service=createStudentOnboardingService({pool:missing.pool});
  await assert.rejects(service.completeProfile({userId:8}),(error)=>error.code==='STUDENT_NOT_FOUND');
});

test('onboarding completion is idempotent for an already completed account',async()=>{
  const db=fakePool((sql)=>sql.includes('FROM students s JOIN users')?{rows:[{id:9,onboarding_required:false,onboarding_completed_at:new Date(),must_change_password:false,google_linked:true}]}:{rows:[]});
  const service=createStudentOnboardingService({pool:db.pool});
  assert.deepEqual(await service.completeProfile({userId:8}),{onboarding_required:false,onboarding_step:'COMPLETE'});
  assert.equal(db.calls.some(({sql})=>sql.includes('UPDATE students SET onboarding_required=FALSE')),false);
  assert(db.calls.some(({sql})=>sql==='COMMIT'));
});

test('onboarding controller rejects official profile fields and forwards only the actor identity',async()=>{
  let received;const controller=createStudentOnboardingController({onboardingService:{completeProfile:async(input)=>{received=input;return{onboarding_required:false,onboarding_step:'COMPLETE'}}}});
  const makeResponse=()=>({json(body){this.body=body;return body},status(code){this.statusCode=code;return this}});
  const rejected=makeResponse();
  await controller.completeOnboarding({body:{academic_level:'SENIOR_HIGH_SCHOOL',strand:'STEM',section:'11-A',year_level:11,phone_number:'09171234567',guardian_name:'Maria Reyes'},user:{id:8,role:'STUDENT'}},rejected);
  assert.equal(rejected.statusCode,400);
  assert.equal(received,undefined);

  const accepted=makeResponse();
  await controller.completeOnboarding({body:{},ip:'127.0.0.1',user:{id:8,role:'STUDENT'}},accepted);
  assert.deepEqual(received,{userId:8,ipAddress:'127.0.0.1'});
  assert.equal(accepted.body.success,true);
  assert.equal(accepted.body.user.onboarding_step,'COMPLETE');
  assert.equal(accepted.body.user.onboarding_required,false);
});
