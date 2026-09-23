const test=require('node:test');
const assert=require('node:assert/strict');
const {createStudentOnboardingService,onboardingState}=require('../src/services/studentOnboardingService');
const {createGoogleIdentityService}=require('../src/services/googleIdentityService');

const fakePool=(handler)=>{const calls=[];const client={async query(sql,params=[]){calls.push({sql:String(sql),params});return handler(String(sql),params)},release(){}};return{calls,pool:{connect:async()=>client}}};

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
    if(sql.includes('FROM users u JOIN students'))return{rows:[{id:8,username:'02000123456',role:'STUDENT',session_version:2,must_change_password:false,student_id:9,first_name:'Ana',last_name:'Reyes',onboarding_required:true,onboarding_completed_at:null,pending_google_email:'ana@gmail.com',pending_google_email_verified_at:new Date(),google_linked:false}]};
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
  let issued;const db=fakePool((sql)=>sql.includes('FROM students s JOIN users')?{rows:[{id:9,user_id:8,role:'STUDENT',must_change_password:false,onboarding_required:true,onboarding_completed_at:null,google_linked:false,pending_google_email:null,pending_google_email_verified_at:null}]}:{rows:[]});
  const otp={issue:async(input)=>{issued=input},verify:async(input)=>{assert.equal(input.email,'student@school.edu');assert.equal(input.code,'123456')}};
  const service=createStudentOnboardingService({pool:db.pool,otpService:otp});
  const requested=await service.requestGoogleEmail({userId:8,email:' Student@School.edu '});
  assert.equal(requested.google_onboarding_stage,'OTP');assert.equal(issued.email,'student@school.edu');
  db.pool.connect=async()=>({async query(sql,params=[]){db.calls.push({sql:String(sql),params});if(String(sql).includes('FROM students s JOIN users'))return{rows:[{id:9,user_id:8,role:'STUDENT',must_change_password:false,onboarding_required:true,onboarding_completed_at:null,google_linked:false,pending_google_email:'student@school.edu',pending_google_email_verified_at:null}]};return{rows:[]}},release(){}});
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

test('academic and contact completion requires Google and atomically unlocks the portal',async()=>{
  const db=fakePool((sql)=>{
    if(sql.includes('FROM students s JOIN users'))return{rows:[{id:9,onboarding_required:true,onboarding_completed_at:null,must_change_password:false,google_linked:true}]};
    if(sql.startsWith('SELECT id FROM student_guardians'))return{rows:[]};
    return{rows:[]};
  });
  const service=createStudentOnboardingService({pool:db.pool});
  const result=await service.completeProfile({userId:8,program:'bsit',section:'A103',yearLevel:2,phoneNumber:'09171234567',guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567'});
  assert.deepEqual(result,{onboarding_required:false,onboarding_step:'COMPLETE'});
  assert(db.calls.some(({sql})=>sql.includes('onboarding_completed_at=CURRENT_TIMESTAMP')));
  assert(db.calls.some(({sql,params})=>sql.startsWith('UPDATE students SET program=')&&params.includes('BSIT')&&params.includes('A103')&&params.includes(2)));
  assert(db.calls.some(({sql})=>sql.includes("'STUDENT_ONBOARDING_COMPLETE'")));
  assert(db.calls.some(({sql})=>sql==='COMMIT'));
});

test('onboarding rejects incomplete or invalid academic information before database access',async()=>{
  const db=fakePool(()=>({rows:[]}));const service=createStudentOnboardingService({pool:db.pool});
  const contact={phoneNumber:'09171234567',guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567'};
  await assert.rejects(service.completeProfile({userId:8,...contact,program:'',section:'A103',yearLevel:1}),(error)=>error.code==='VALIDATION_ERROR');
  await assert.rejects(service.completeProfile({userId:8,...contact,program:'INVALID',section:'A103',yearLevel:1}),(error)=>error.code==='INVALID_PROGRAM');
  await assert.rejects(service.completeProfile({userId:8,...contact,program:'BSIT',section:'A103',yearLevel:9}),(error)=>error.code==='INVALID_YEAR_LEVEL');
  assert.equal(db.calls.length,0);
});
