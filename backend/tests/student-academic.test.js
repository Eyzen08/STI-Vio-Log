const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeAcademic,inferAcademicLevel} = require('../src/utils/studentAcademic');
const pool = require('../src/config/database');
const {updateStudent} = require('../src/controllers/studentController');
const college = {program:'BSIT',year_level:2,section:'A103'};
test('academic contract defaults legacy new submissions to College and normalizes case',()=>{
 assert.deepEqual(normalizeAcademic({...college,program:'bsit'}),{academic_level:'COLLEGE',strand:null,...college});
 for(const [strand,year_level] of [['ABM',11],['STEM',12]]) assert.deepEqual(normalizeAcademic({academic_level:'SENIOR_HIGH_SCHOOL',strand,year_level,section:'SHS-A'}),{academic_level:'SENIOR_HIGH_SCHOOL',strand,program:null,year_level,section:'SHS-A'});
});
test('academic contract rejects unsupported strand, mode, years, and missing section',()=>{
 for(const input of [{...college,strand:'ABM'},{...college,year_level:5},{...college,academic_level:'UNKNOWN'},{...college,section:''},{academic_level:'SENIOR_HIGH_SCHOOL',strand:'GAS',year_level:11,section:'A'},{academic_level:'SENIOR_HIGH_SCHOOL',year_level:11,section:'A'},{academic_level:'SENIOR_HIGH_SCHOOL',strand:'STEM',year_level:1,section:'A'}]) assert.throws(()=>normalizeAcademic(input));
});
test('historical academic inference preserves explicit level and unknown values',()=>{
 assert.equal(inferAcademicLevel({year_level:11}),'SENIOR_HIGH_SCHOOL');
 assert.equal(inferAcademicLevel({year_level:8}),'COLLEGE');
 assert.equal(inferAcademicLevel({academic_level:'COLLEGE',year_level:11}),'COLLEGE');
 assert.equal(inferAcademicLevel({year_level:9}),null);
 assert.equal(inferAcademicLevel({}),null);
 assert.equal(normalizeAcademic({...college,year_level:8},{legacy:true}).year_level,8);
 assert.equal(normalizeAcademic({academic_level:'SENIOR_HIGH_SCHOOL',year_level:11,section:'A'},{legacy:true}).strand,null);
});
test('audited staff edits validate merged academic fields and preserve unrelated legacy edits',async()=>{
 const original=pool.connect;
 let current={id:9,user_id:8,student_number:'02000123456',academic_level:'COLLEGE',program:'BSIT',year_level:8,section:'A103',strand:null};
 const calls=[];
 pool.connect=async()=>({query:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT id,user_id,student_number'))return{rows:[current]};return{rows:[current]};},release(){}});
 const run=async(body)=>{const res={statusCode:200,status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};calls.length=0;await updateStudent({params:{id:'9'},user:{id:1},body,ip:'127.0.0.1'},res);return res;};
 try {
  assert.equal((await run({first_name:'Corrected',reason:'Legal name correction'})).statusCode,200);
  assert(calls.some(x=>x.sql.includes("'STUDENT_UPDATE'")));
  assert.equal((await run({section:'New',reason:'Academic correction'})).statusCode,400);
  assert(calls.some(x=>x.sql==='ROLLBACK'));
  assert.equal((await run({academic_level:'SENIOR_HIGH_SCHOOL',strand:'STEM',year_level:12,reason:'Confirmed SHS record'})).statusCode,200);
  const update=calls.find(x=>x.sql.includes('UPDATE students'));
  assert(update.params.includes('STEM')); assert(update.params.includes(12)); assert(update.params.includes(null));
  current={...current,academic_level:'SENIOR_HIGH_SCHOOL',program:null,year_level:11};
  assert.equal((await run({last_name:'Corrected',reason:'Name correction'})).statusCode,200);
  assert.equal((await run({year_level:12,reason:'Grade correction'})).statusCode,400);
  assert.equal((await run({strand:'ABM',year_level:12,reason:'Grade and strand correction'})).statusCode,200);
  assert.equal((await run({strand:'ABM'})).statusCode,400);
 } finally {pool.connect=original;}
});
