const test=require('node:test');
const assert=require('node:assert/strict');
const {createStudentOnboardingService,onboardingState}=require('../src/services/studentOnboardingService');
const {createGoogleIdentityService}=require('../src/services/googleIdentityService');

const fakePool=(handler)=>{const calls=[];const client={async query(sql,params=[]){calls.push({sql:String(sql),params});return handler(String(sql),params)},release(){}};return{calls,pool:{connect:async()=>client}}};

test('onboarding state advances through password, Google, profile, and completion',()=>{
  const base={role:'STUDENT',onboarding_required:true,onboarding_completed_at:null};
  assert.deepEqual(onboardingState({...base,must_change_password:true,google_linked:false}),{onboarding_required:true,onboarding_step:'PASSWORD'});
  assert.deepEqual(onboardingState({...base,must_change_password:false,google_linked:false}),{onboarding_required:true,onboarding_step:'GOOGLE'});
  assert.deepEqual(onboardingState({...base,must_change_password:false,google_linked:true}),{onboarding_required:true,onboarding_step:'PROFILE'});
  assert.deepEqual(onboardingState({...base,onboarding_completed_at:new Date(),google_linked:true}),{onboarding_required:false,onboarding_step:'COMPLETE'});
});

test('authenticated Google binding verifies email and establishes recovery address',async()=>{
  const db=fakePool((sql)=>{
    if(sql.includes('FROM users u JOIN students'))return{rows:[{id:8,username:'02000123456',role:'STUDENT',session_version:2,must_change_password:false,student_id:9,first_name:'Ana',last_name:'Reyes',onboarding_required:true,onboarding_completed_at:null,google_linked:false}]};
    if(sql.startsWith('SELECT id,user_id,google_subject'))return{rows:[]};
    if(sql.startsWith('INSERT INTO google_identity_links'))return{rows:[{id:17}]};
    return{rows:[]};
  });
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'private-subject',email:'ana@gmail.com',emailVerified:true}),issueToken:()=>null});
  const result=await service.linkAuthenticatedStudent({userId:8,credential:'private-token'});
  assert.equal(result.user.onboarding_step,'PROFILE');
  assert(db.calls.some(({sql,params})=>sql.startsWith('UPDATE students SET email=')&&params.includes('ana@gmail.com')));
  assert(db.calls.some(({sql})=>sql.includes('email_verified=TRUE')));
  assert.equal(db.calls.some(({sql,params})=>sql.includes('private-token')||params.includes('private-token')),false);
  assert.equal(db.calls.some(({sql})=>sql.includes('private-subject')&&sql.includes('audit_logs')),false);
});

test('authenticated Google binding rejects an unverified email before database access',async()=>{
  const db=fakePool(()=>({rows:[]}));
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'subject',email:'student@gmail.com',emailVerified:false}),issueToken:()=>null});
  await assert.rejects(service.linkAuthenticatedStudent({userId:8,credential:'token'}),(error)=>error.code==='GOOGLE_EMAIL_UNVERIFIED');
  assert.equal(db.calls.length,0);
});

test('contact completion requires Google and atomically unlocks the portal',async()=>{
  const db=fakePool((sql)=>{
    if(sql.includes('FROM students s JOIN users'))return{rows:[{id:9,onboarding_required:true,onboarding_completed_at:null,must_change_password:false,google_linked:true}]};
    if(sql.startsWith('SELECT id FROM student_guardians'))return{rows:[]};
    return{rows:[]};
  });
  const service=createStudentOnboardingService({pool:db.pool});
  const result=await service.completeProfile({userId:8,phoneNumber:'09171234567',guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567'});
  assert.deepEqual(result,{onboarding_required:false,onboarding_step:'COMPLETE'});
  assert(db.calls.some(({sql})=>sql.includes('onboarding_completed_at=CURRENT_TIMESTAMP')));
  assert(db.calls.some(({sql})=>sql.includes("'STUDENT_ONBOARDING_COMPLETE'")));
  assert(db.calls.some(({sql})=>sql==='COMMIT'));
});
