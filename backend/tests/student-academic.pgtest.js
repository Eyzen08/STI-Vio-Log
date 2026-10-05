const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Pool}=require('pg');
require('dotenv').config({quiet:true});
const {testDatabaseConfig}=require('./testDatabase');
const {runMigrations}=require('../scripts/migrate');
const {createStudentOnboardingService}=require('../src/services/studentOnboardingService');
const {createStudentPasswordAuthService}=require('../src/services/studentPasswordAuthService');
const {createGoogleRegistrationService}=require('../src/services/googleRegistrationService');
const {createGoogleIdentityService}=require('../src/services/googleIdentityService');
const schema='sti_vio_log_test_academic_'+process.pid+'_'+Date.now();
const admin=new Pool(testDatabaseConfig());
const pool=new Pool(testDatabaseConfig(schema));
const migrationDir=path.resolve(__dirname,'../../database/migrations');
const beforeDir=fs.mkdtempSync(path.join(os.tmpdir(),'sti-academic-before-'));
const hash='$2b$04$abcdefghijklmnopqrstuuXJfM5Z0nJf4wPMFnYbPxM3Ya7kXyQYO';
let reviewer;
const createStudent=async(number,year,level=null)=>{
 const user=(await pool.query("INSERT INTO users(username,password_hash,role,must_change_password) VALUES($1,$2,'STUDENT',FALSE) RETURNING id",[number,hash])).rows[0];
 const student=(await pool.query("INSERT INTO students(user_id,student_number,first_name,last_name,program,section,year_level,academic_level,qr_code,onboarding_required) VALUES($1,$2,'Test','Student','BSIT','A103',$3,$4,$5,TRUE) RETURNING *",[user.id,number,year,level,'QR-'+number])).rows[0];
 return {user,student};
};
test.before(async()=>{
 await admin.query('CREATE SCHEMA '+schema);
 for(const name of fs.readdirSync(migrationDir).filter(n=>n.endsWith('.sql')&&n<'043_'))fs.copyFileSync(path.join(migrationDir,name),path.join(beforeDir,name));
 await runMigrations(pool,{directory:beforeDir,logger:{log(){}}});
 reviewer=(await pool.query("INSERT INTO users(username,password_hash,role) VALUES('academic_reviewer',$1,'DISCIPLINE_ADMIN') RETURNING id",[hash])).rows[0].id;
});
test.after(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();fs.rmSync(beforeDir,{recursive:true,force:true});});
test('043 infers only missing levels, preserves programs and access, and is tracked once',async()=>{
 const rows=[];
 for(const [i,year,level] of [[1,11,null],[2,8,null],[3,9,null],[4,12,'COLLEGE']]) rows.push(await createStudent('0200000000'+i,year,level));
 await pool.query('UPDATE students SET onboarding_required=FALSE,onboarding_completed_at=CURRENT_TIMESTAMP WHERE id=$1',[rows[1].student.id]);
 await pool.query("INSERT INTO student_account_registrations(student_number,full_name,email,password_hash,year_level) VALUES('02000000901','Legacy Applicant','legacy@example.test',$1,6)",[hash]);
 await pool.query("INSERT INTO google_student_registrations(google_subject,student_number,first_name,last_name,year_level) VALUES('legacy-google','02000000902','Legacy','Applicant',6)");
 const result=await runMigrations(pool,{logger:{log(){}}});assert.deepEqual(result.applied,['043_student_academic_strands.sql']);
 const records=(await pool.query('SELECT academic_level,strand,program,onboarding_required,onboarding_completed_at FROM students ORDER BY student_number')).rows;
 assert.deepEqual(records.map(r=>r.academic_level),['SENIOR_HIGH_SCHOOL','COLLEGE',null,'COLLEGE']);
 for(const [i,r] of records.entries()){assert.equal(r.strand,null);assert.equal(r.program,'BSIT');assert.equal(r.onboarding_required,i!==1);if(i===1)assert(r.onboarding_completed_at);else assert.equal(r.onboarding_completed_at,null);}
 assert.equal((await pool.query('SELECT academic_level FROM student_account_registrations')).rows[0].academic_level,'COLLEGE');
 assert.equal((await pool.query('SELECT academic_level FROM google_student_registrations')).rows[0].academic_level,'COLLEGE');
 assert.deepEqual((await runMigrations(pool,{logger:{log(){}}})).applied,[]);
 await assert.rejects(pool.query("UPDATE students SET strand='GAS' WHERE id=$1",[rows[0].student.id]),e=>e.code==='23514');
});
test('College, ABM, and STEM onboarding persist academic details and preserve Google identity access',async()=>{
 const service=createStudentOnboardingService({pool});
 let index=20;
 for(const input of [{academicLevel:'COLLEGE',program:'BSIT',yearLevel:2},{academicLevel:'SENIOR_HIGH_SCHOOL',strand:'ABM',yearLevel:11},{academicLevel:'SENIOR_HIGH_SCHOOL',strand:'STEM',yearLevel:12}]){
  const number='020000000'+(++index);
  const {user,student}=await createStudent(number,1);
  const subject='onboarding-'+number;
  await pool.query('INSERT INTO google_identity_links(user_id,google_subject,google_email) VALUES($1,$2,$3)',[user.id,subject,number+'@example.test']);
  await service.completeProfile({...input,userId:user.id,section:'TEST-A',phoneNumber:'09171234567',guardianName:'Test Guardian',guardianRelationship:'Parent',guardianPhoneNumber:'09181234567'});
  const saved=(await pool.query('SELECT * FROM students WHERE id=$1',[student.id])).rows[0];
  assert.equal(saved.academic_level,input.academicLevel);assert.equal(saved.strand,input.strand||null);assert.equal(saved.year_level,input.yearLevel);assert.equal(saved.program,input.program||null);assert.equal(saved.onboarding_required,false);
  const identity=createGoogleIdentityService({pool,verifyIdentity:async()=>({subject,email:number+'@example.test',emailVerified:true}),issueToken:()=>null});
  assert.equal((await identity.loginStudent({credential:'verified-test-identity'})).user.onboarding_step,'COMPLETE');
 }
});
test('retained password verification and Google approval carry College and SHS academic values',async()=>{
 const passwords=createStudentPasswordAuthService({pool,otpService:{issue:async()=>{},verify:async()=>{}},hashPassword:async()=>hash});
 const reviews=createGoogleRegistrationService({pool,hashPassword:async()=>hash});
 let index=40;
 for(const academic of [{academicLevel:'COLLEGE',program:'BSIT',yearLevel:2},{academicLevel:'SENIOR_HIGH_SCHOOL',strand:'ABM',yearLevel:11},{academicLevel:'SENIOR_HIGH_SCHOOL',strand:'STEM',yearLevel:12}]){
  const number='020000000'+(++index);
  const result=await passwords.register({...academic,firstName:'Password',lastName:'Student',studentNumber:number,email:number+'@example.test',phoneNumber:'09171234567',section:'TEST-A',guardianName:'Test Guardian',guardianRelationship:'Parent',guardianPhoneNumber:'09181234567',password:'UniquePass@1234',confirmPassword:'UniquePass@1234'});
  await passwords.verifyRegistration({registrationId:result.registration_id,code:'123456'});
  const student=(await pool.query('SELECT * FROM students WHERE student_number=$1',[number])).rows[0];
  assert.equal(student.academic_level,academic.academicLevel);assert.equal(student.strand,academic.strand||null);assert.equal(student.year_level,academic.yearLevel);
  const googleNumber='020000000'+(++index);
  const registration=(await pool.query("INSERT INTO google_student_registrations(google_subject,google_email,student_number,first_name,last_name,phone_number,program,section,year_level,guardian_name,guardian_relationship,guardian_phone_number,academic_level,strand) VALUES($1,$2,$3,'Google','Student','09171234567',$4,'TEST-A',$5,'Test Guardian','Parent','09181234567',$6,$7) RETURNING id",['google-'+googleNumber,googleNumber+'@example.test',googleNumber,academic.program||null,academic.yearLevel,academic.academicLevel,academic.strand||null])).rows[0];
  await reviews.review({registrationId:registration.id,reviewerId:reviewer,decision:'APPROVED',reason:'Reviewed test enrollment'});
  const googleStudent=(await pool.query('SELECT * FROM students WHERE student_number=$1',[googleNumber])).rows[0];
  assert.equal(googleStudent.academic_level,academic.academicLevel);assert.equal(googleStudent.strand,academic.strand||null);assert.equal(googleStudent.program,academic.program||null);
 }
});
