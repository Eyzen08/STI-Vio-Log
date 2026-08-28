const test=require('node:test');
const assert=require('node:assert/strict');
const pool=require('../src/config/database');
const {createStudent}=require('../src/controllers/studentController');
const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});

test('student creation rejects legacy user_id ownership input',async()=>{const res=response();await createStudent({user:{id:1},body:{user_id:9,student_number:'02000123456',first_name:'Test',last_name:'Student',qr_code:'opaque'}},res);assert.equal(res.statusCode,400)});

test('student number creates the local student account and profile atomically',async()=>{const originalConnect=pool.connect;const queries=[];pool.connect=async()=>({query:async(sql,params)=>{const text=String(sql);queries.push({text,params});if(text.includes('INSERT INTO users'))return{rows:[{id:44}]};if(text.includes('INSERT INTO students'))return{rows:[{id:55,user_id:44,student_number:params[1],first_name:params[2],last_name:params[4]}]};return{rows:[]}},release(){}});try{const res=response();await createStudent({user:{id:1},ip:'127.0.0.1',body:{student_number:'02000123456',first_name:'Test',last_name:'Student',section:'A103',qr_code:'opaque-qr'}},res);assert.equal(res.statusCode,201);assert.equal(res.body.student.user_id,44);assert(queries.some(({text,params})=>text.includes('INSERT INTO users')&&params[0]==='02000123456'));assert.equal(JSON.stringify(res.body).includes('password'),false);assert(queries.some(({text})=>text.includes("'STUDENT_CREATE'")))}finally{pool.connect=originalConnect}});
