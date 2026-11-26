const test=require('node:test');
const assert=require('node:assert/strict');
const pool=require('../src/config/database');
const {createStudent,updateStudent,resetStudentPassword}=require('../src/controllers/studentController');
const { serviceDate } = require('../src/services/communityServiceTiming');
const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});

// The Discipline Office now supplies the full official profile when creating an
// account. Tests start from this valid baseline and override one field at a time.
const officialProfile = (overrides = {}) => ({
  student_number:'02000123456',
  first_name:'Test',
  middle_name:'Middle',
  last_name:'Student',
  suffix:'',
  email:'student@gmail.com',
  academic_level:'COLLEGE',
  program:'BSIT',
  section:'A103',
  year_level:1,
  phone_number:'09171234567',
  guardian_name:'Maria Santos',
  guardian_relationship:'Mother',
  guardian_phone_number:'09187654321',
  ...overrides
});

test('email edits recheck active Google links after locking the student record',async()=>{
  const previousConnect=pool.connect;const queries=[];
  pool.connect=async()=>({query:async(sql)=>{queries.push(sql);if(sql.startsWith('SELECT id,user_id'))return{rows:[{id:55,user_id:44,email:'old@gmail.com',onboarding_required:true,google_linked:false}]};if(sql.startsWith('SELECT 1 FROM google_identity_links'))return{rows:[{exists:1}]};return{rows:[]}},release(){}});
  try{
    const res=response();await updateStudent({user:{id:1},params:{id:'55'},body:{email:'new@gmail.com',reason:'Correct Gmail'}},res);
    assert.equal(res.statusCode,409);assert.match(res.body.message,/Google account recovery/);
    assert.equal(queries.some(sql=>sql.includes('UPDATE students')),false);
  }finally{pool.connect=previousConnect}
});

test('student creation rejects malformed identity fields before database access', async()=>{
  const originalConnect=pool.connect;
  pool.connect=async()=>{throw new Error('Invalid identity must not reach the database')};
  try {
    for(const [field,value] of [['first_name','Juan123'],['first_name','---'],['last_name','$Reyes'],['middle_name','123'],['suffix','@'],['suffix','XI']]) {
      const res=response();
      await createStudent({user:{id:1},body:officialProfile({[field]:value})},res);
      assert.equal(res.statusCode,400,field);
    }
  } finally {pool.connect=originalConnect}
});

test('student edits preserve unchanged legacy identities and reject invalid changed fields',async()=>{
  const originalConnect=pool.connect;
  const original={id:55,user_id:44,student_number:'LEGACY-1',first_name:'Legacy123',middle_name:'',last_name:'Reyes',suffix:'Legacy suffix'};
  const writes=[];
  pool.connect=async()=>({query:async(sql,params)=>{if(String(sql).startsWith('SELECT id,user_id'))return{rows:[original]};if(String(sql).includes('UPDATE students')){writes.push(params);return{rows:[original]}};return{rows:[]}},release(){}});
  try {
    const preserved=response();
    await updateStudent({user:{id:1},params:{id:'55'},body:{student_number:original.student_number,first_name:original.first_name,suffix:original.suffix,reason:'Unrelated correction'}},preserved);
    assert.equal(preserved.statusCode,200);
    for(const [field,value] of [['student_number','NEW-ID'],['first_name','New123'],['middle_name','---'],['suffix','XI']]) {
      const rejected=response();await updateStudent({user:{id:1},params:{id:'55'},body:{[field]:value,reason:'Identity correction'}},rejected);assert.equal(rejected.statusCode,400,field);
    }
    assert.equal(writes.length,1);
  } finally {pool.connect=originalConnect}
});

test('student creation rejects unsupported ownership and system fields before database access',async()=>{const originalConnect=pool.connect;pool.connect=async()=>{throw new Error('Unsupported fields must not reach the database')};try{for(const field of ['user_id','qr_code','profile_image','role','must_change_password','onboarding_required']){const res=response();await createStudent({user:{id:1},body:officialProfile({[field]:'unsupported'})},res);assert.equal(res.statusCode,400,field)}}finally{pool.connect=originalConnect}});

test('student number, legal name, and Gmail create an account without automatically emailing it',async()=>{
  const originalConnect=pool.connect;
  const queries=[];
  const originalFetch=global.fetch;
  let sends=0;
  global.fetch=async()=>{sends++;throw new Error('Creation must not send email')};
  pool.connect=async()=>({query:async(sql,params)=>{
    const text=String(sql);queries.push({text,params});
    if(text.includes('INSERT INTO users'))return{rows:[{id:44,username:'02000123456',must_change_password:true}]};
    if(text.includes('INSERT INTO students'))return{rows:[{id:55,user_id:44,student_number:params[1],first_name:params[2],last_name:params[4],qr_code:params[6],email:params[7]}]};
    return{rows:[]}
  },release(){}});
  try{
    const res=response();
    await createStudent({user:{id:1},ip:'127.0.0.1',body:officialProfile({suffix:'Jr.',email:'  Student@GMAIL.COM  '})},res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.student.user_id,44);
    assert.equal(res.body.student.email,'student@gmail.com');
    assert.match(res.body.student.qr_code,/^STI-[0-9a-f-]{36}$/i);
    assert.equal(res.body.account.username,'02000123456');
    assert.match(res.body.temporary_password,/!Aa1$/);
    assert.equal(res.body.password_change_required,true);
    assert.equal(res.body.onboarding_required,true);
    assert.equal(res.body.onboarding_step,'PASSWORD');
    assert.equal(res.body.first_violation,undefined);
    assert.equal(sends,0);
    assert(queries.some(({text,params})=>text.includes('INSERT INTO users')&&params[0]==='02000123456'&&text.includes('must_change_password')));
    assert(queries.some(({text,params})=>text.includes('INSERT INTO student_guardians')&&params[1]==='Maria Santos'&&params[2]==='Mother'&&params[3]==='+639187654321'));
    assert(queries.some(({text,params})=>text.includes('INSERT INTO students')&&params.includes('COLLEGE')&&params.includes('BSIT')&&params.includes('A103')&&params.includes(1)&&params.includes('+639171234567')));
    assert(queries.some(({text})=>text.includes('student-registration-email:')));
    assert(queries.some(({text})=>text.includes("'STUDENT_CREATE'")));
  }finally{pool.connect=originalConnect;global.fetch=originalFetch}
});

test('student creation requires a valid personal Gmail before accessing the database',async()=>{
  const originalConnect=pool.connect;
  pool.connect=async()=>{throw new Error('Validation should happen first')};
  try{
    for(const email of [undefined,null,123,'','student@yahoo.com','student@sti.edu.ph','a@@gmail.com','a b@gmail.com','@gmail.com','a'.repeat(246)+'@gmail.com']){
      const res=response();
      await createStudent({user:{id:1},body:officialProfile({email})},res);
      assert.equal(res.statusCode,400,String(email));
      assert.match(res.body.message,/Gmail/);
    }
  }finally{pool.connect=originalConnect}
});

test('duplicate student Gmail rolls back without creating an account',async()=>{
  const originalConnect=pool.connect;
  const queries=[];
  let released=false;
  pool.connect=async()=>({query:async(sql,params)=>{queries.push({sql,params});return{rows:String(sql).includes('SELECT 1 FROM students')?[{exists:1}]:[]}},release(){released=true}});
  try{
    const res=response();
    await createStudent({user:{id:1},body:officialProfile({email:'Student@gmail.com'})},res);
    assert.equal(res.statusCode,409);
    assert.match(res.body.message,/Gmail address is already assigned/);
    assert(queries.some(({sql})=>sql==='ROLLBACK'));
    assert(!queries.some(({sql})=>String(sql).includes('INSERT INTO users')));
    assert.equal(released,true);
  }finally{pool.connect=originalConnect}
});

test('identical student and guardian numbers are rejected after normalization',async()=>{
  const originalConnect=pool.connect;
  pool.connect=async()=>{throw new Error('Duplicate phone numbers must not reach the database')};
  try{
    const res=response();
    await createStudent({user:{id:1},body:officialProfile({phone_number:'09171234567',guardian_phone_number:'0917-123-4567'})},res);
    assert.equal(res.statusCode,400);
    assert.match(res.body.message,/must be different/);
  }finally{pool.connect=originalConnect}
});

test('optional first violation is created in the same transaction with a backfilled past date',async()=>{
  const originalConnect=pool.connect;
  const queries=[];
  let released=false;
  pool.connect=async()=>({query:async(sql,params=[])=>{
    const text=String(sql);queries.push({text,params});
    if(text.includes('INSERT INTO users'))return{rows:[{id:44,username:'02000123456',must_change_password:true}]};
    if(text.includes('INSERT INTO students'))return{rows:[{id:55,user_id:44,student_number:params[1]}]};
    if(text.includes('SELECT id FROM violation_types'))return{rows:[{id:3}]};
    if(text.includes('INSERT INTO violations'))return{rows:[{id:70,student_id:55,violation_type_id:3}]};
    if(text.includes('COUNT(*)')&&text.includes('FROM violations'))return{rows:[{count:'1'}]};
    if(text.includes('COUNT(*)')&&text.includes('FROM community_service_assignments'))return{rows:[{count:'0'}]};
    return{rows:[]}
  },release(){released=true}});
  try{
    const res=response();
    await createStudent({user:{id:1,role:'DISCIPLINE_ADMIN'},ip:'127.0.0.1',body:officialProfile({first_violation:{violation_type_id:3,incident_date:'2026-01-15',incident_time:'09:15',description:'No school ID.'}})},res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.first_violation.id,70);
    const studentInsert=queries.findIndex(({text})=>text.includes('INSERT INTO students'));
    const guardianInsert=queries.findIndex(({text})=>text.includes('INSERT INTO student_guardians'));
    const violationInsert=queries.findIndex(({text})=>text.includes('INSERT INTO violations'));
    assert(studentInsert>=0&&guardianInsert>studentInsert&&violationInsert>guardianInsert);
    assert(queries.some(({text,params})=>text.includes('INSERT INTO violations')&&params.includes('2026-01-15')&&params.includes('09:15')&&params.includes('No school ID.')));
    assert(queries.some(({text,params})=>text.includes('INSERT INTO audit_logs')&&String(params[2]).includes('first violation #70')));
    assert(queries.some(({text})=>text==='COMMIT'));
    assert.equal(released,true);
  }finally{pool.connect=originalConnect}
});

test('first violation rejects a future date before writing account rows',async()=>{
  const originalConnect=pool.connect;
  pool.connect=async()=>{throw new Error('A future first-violation date must not reach the database')};
  try{
    const res=response();
    await createStudent({user:{id:1},body:officialProfile({first_violation:{violation_type_id:3,incident_date:'2999-01-01',incident_time:'09:15',description:'Future entry'}})},res);
    assert.equal(res.statusCode,400);
    assert.match(res.body.message,/cannot be in the future/);
  }finally{pool.connect=originalConnect}
});

test('student information update keeps the local username synchronized and audits the reason',async()=>{const originalConnect=pool.connect;const queries=[];pool.connect=async()=>({query:async(sql,params)=>{const text=String(sql);queries.push({text,params});if(text.includes('SELECT id,user_id,student_number'))return{rows:[{id:55,user_id:44,student_number:'02000123456'}]};if(text.includes('UPDATE students'))return{rows:[{id:55,student_number:'02000987654',first_name:'Updated',last_name:'Student'}]};return{rows:[]}},release(){}});try{const res=response();await updateStudent({user:{id:1},params:{id:'55'},ip:'127.0.0.1',body:{student_number:'02000987654',first_name:'Updated',last_name:'Student',reason:'Corrected school record'}},res);assert.equal(res.statusCode,200);assert(queries.some(({text,params})=>text.includes('UPDATE users SET username')&&params[1]==='02000987654'));assert(queries.some(({text,params})=>text.includes("'STUDENT_UPDATE'")&&params[2].includes('Corrected school record')))}finally{pool.connect=originalConnect}});

test('student password reset returns a one-time credential and forces password change',async()=>{const originalConnect=pool.connect;const queries=[];pool.connect=async()=>({query:async(sql,params)=>{const text=String(sql);queries.push({text,params});if(text.includes("u.role='STUDENT'"))return{rows:[{id:44,username:'new-2'}]};return{rows:[]}},release(){}});try{const res=response();await resetStudentPassword({user:{id:1},params:{id:'55'},ip:'127.0.0.1',body:{reason:'Student requested local access'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.account.username,'new-2');assert.match(res.body.temporary_password,/!Aa1$/);assert(queries.some(({text})=>text.includes('must_change_password=TRUE')&&text.includes('session_version=session_version+1')));assert(queries.some(({text})=>text.includes("'STUDENT_PASSWORD_RESET'")))}finally{pool.connect=originalConnect}});
