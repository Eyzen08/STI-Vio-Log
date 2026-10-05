const test=require('node:test');
const assert=require('node:assert/strict');
const pool=require('../src/config/database');
const {createStudent,updateStudent,resetStudentPassword}=require('../src/controllers/studentController');
const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});

test('student creation rejects profile and ownership fields',async()=>{for(const field of ['user_id','phone_number','program','section','year_level','qr_code','profile_image']){const res=response();await createStudent({user:{id:1},body:{student_number:'02000123456',first_name:'Test',last_name:'Student',email:'student@gmail.com',[field]:'unsupported'}},res);assert.equal(res.statusCode,400,field)}});

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
    await createStudent({user:{id:1},ip:'127.0.0.1',body:{student_number:'02000123456',first_name:'Test',middle_name:'Middle',last_name:'Student',suffix:'Jr.',email:'  Student@GMAIL.COM  '}},res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.student.user_id,44);
    assert.equal(res.body.student.email,'student@gmail.com');
    assert.match(res.body.student.qr_code,/^STI-[0-9a-f-]{36}$/i);
    assert.equal(res.body.account.username,'02000123456');
    assert.match(res.body.temporary_password,/!Aa1$/);
    assert.equal(res.body.password_change_required,true);
    assert.equal(res.body.onboarding_required,true);
    assert.equal(res.body.onboarding_step,'PASSWORD');
    assert.equal(sends,0);
    assert(queries.some(({text,params})=>text.includes('INSERT INTO users')&&params[0]==='02000123456'&&text.includes('must_change_password')));
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
      await createStudent({user:{id:1},body:{student_number:'02000123456',first_name:'Test',last_name:'Student',email}},res);
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
    await createStudent({user:{id:1},body:{student_number:'02000123456',first_name:'Test',last_name:'Student',email:'Student@gmail.com'}},res);
    assert.equal(res.statusCode,409);
    assert.match(res.body.message,/Gmail address is already assigned/);
    assert(queries.some(({sql})=>sql==='ROLLBACK'));
    assert(!queries.some(({sql})=>String(sql).includes('INSERT INTO users')));
    assert.equal(released,true);
  }finally{pool.connect=originalConnect}
});

test('student information update keeps the local username synchronized and audits the reason',async()=>{const originalConnect=pool.connect;const queries=[];pool.connect=async()=>({query:async(sql,params)=>{const text=String(sql);queries.push({text,params});if(text.includes('SELECT id,user_id,student_number'))return{rows:[{id:55,user_id:44,student_number:'02000123456'}]};if(text.includes('UPDATE students'))return{rows:[{id:55,student_number:'02000987654',first_name:'Updated',last_name:'Student'}]};return{rows:[]}},release(){}});try{const res=response();await updateStudent({user:{id:1},params:{id:'55'},ip:'127.0.0.1',body:{student_number:'02000987654',first_name:'Updated',last_name:'Student',reason:'Corrected school record'}},res);assert.equal(res.statusCode,200);assert(queries.some(({text,params})=>text.includes('UPDATE users SET username')&&params[1]==='02000987654'));assert(queries.some(({text,params})=>text.includes("'STUDENT_UPDATE'")&&params[2].includes('Corrected school record')))}finally{pool.connect=originalConnect}});

test('student password reset returns a one-time credential and forces password change',async()=>{const originalConnect=pool.connect;const queries=[];pool.connect=async()=>({query:async(sql,params)=>{const text=String(sql);queries.push({text,params});if(text.includes("u.role='STUDENT'"))return{rows:[{id:44,username:'new-2'}]};return{rows:[]}},release(){}});try{const res=response();await resetStudentPassword({user:{id:1},params:{id:'55'},ip:'127.0.0.1',body:{reason:'Student requested local access'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.account.username,'new-2');assert.match(res.body.temporary_password,/!Aa1$/);assert(queries.some(({text})=>text.includes('must_change_password=TRUE')&&text.includes('session_version=session_version+1')));assert(queries.some(({text})=>text.includes("'STUDENT_PASSWORD_RESET'")))}finally{pool.connect=originalConnect}});
