import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidStudentGmail, normalizeStudentGmail, sendStudentCredentialsEmail } from '../src/lib/studentAccount.js'
import * as studentAccount from '../src/lib/studentAccount.js'
import { manilaToday } from '../src/lib/displayFormat.js'

test('new student Gmail normalizes casing and rejects missing, invalid, other-provider and overlength addresses', () => {
  assert.equal(normalizeStudentGmail(' Student@GMAIL.COM '), 'student@gmail.com')
  assert.equal(isValidStudentGmail(' Student@GMAIL.COM '), true)
  for (const email of [null, undefined, 123, '', '@gmail.com', 'a@@gmail.com', 'a b@gmail.com', 'student@yahoo.com', 'student@sti.edu.ph', 'a'.repeat(246) + '@gmail.com']) assert.equal(isValidStudentGmail(email), false, String(email))
})

test('manual credential email posts only the temporary password to the protected student endpoint', async () => {
  let request
  const result = await sendStudentCredentialsEmail({apiUrl:'https://api.example.test', token:'test-session', studentId:55, password:'Private-test!Aa1', fetchImpl:async(url,options)=>{
    request={url,options}
    return {ok:true, json:async()=>({success:true,email_status:'sent'})}
  }})
  assert.equal(request.url, 'https://api.example.test/api/students/55/credentials-email')
  assert.equal(request.options.method,'POST')
  assert.deepEqual(JSON.parse(request.options.body), {temporary_password:'Private-test!Aa1'})
  assert.equal(result.email_status,'sent')
})

test('email errors propagate so the confirmation can offer retry without recreating the account', async () => {
  const input={apiUrl:'',token:'test-session',studentId:55,password:'Private-test!Aa1'}
  await assert.rejects(sendStudentCredentialsEmail({...input,fetchImpl:async()=>({ok:false,json:async()=>({message:'Account created, but email could not be sent.'})})}),/Account created, but email could not be sent/)
  await assert.rejects(sendStudentCredentialsEmail({...input,fetchImpl:async()=>({ok:false,json:async()=>{throw new Error('Invalid JSON')}})}),/Retry or copy/)
  await assert.rejects(sendStudentCredentialsEmail({...input,fetchImpl:async()=>{throw new Error('Offline')}}),/Offline/)
})

test('review creates a normalized snapshot of exactly the permitted account details', () => {
  const draft = {student_number:' 02000123456 ',first_name:' Juan   Carlos ',last_name:' Dela Cruz ',middle_name:' ',suffix:'',email:' STUDENT@GMAIL.COM ',academic_level:'COLLEGE',program:'BSIT',section:' A103 ',year_level:'2',phone_number:'09171234567',guardian_name:' Maria   Santos ',guardian_relationship:' Mother ',guardian_phone_number:'0918-765-4321',include_first_violation:false,role:'ADMIN'}
  const reviewed = studentAccount.reviewStudentAccount(draft)
  assert.deepEqual(reviewed,{student_number:'02000123456',first_name:'Juan Carlos',last_name:'Dela Cruz',middle_name:'',suffix:'',email:'student@gmail.com',academic_level:'COLLEGE',strand:null,program:'BSIT',section:'A103',year_level:2,phone_number:'+639171234567',guardian_name:'Maria Santos',guardian_relationship:'Mother',guardian_phone_number:'+639187654321'})
  draft.email='changed@gmail.com'
  assert.equal(reviewed.email,'student@gmail.com')
})

test('review accepts an optional first violation only for the current Manila date', () => {
  const draft = {student_number:'02000123456',first_name:'Juan',last_name:'Santos',middle_name:'',suffix:'',email:'student@gmail.com',academic_level:'COLLEGE',program:'BSIT',section:'A103',year_level:'1',phone_number:'09171234567',guardian_name:'Maria Santos',guardian_relationship:'Mother',guardian_phone_number:'09187654321',include_first_violation:true,violation_type_id:'3',incident_date:manilaToday(),incident_time:'09:15',exact_offense:'Uniform violation',incident_details:'No school ID.'}
  const reviewed=studentAccount.reviewStudentAccount(draft)
  assert.equal(reviewed.first_violation.violation_type_id,3)
  assert.equal(reviewed.first_violation.incident_time,'09:15')
  assert.match(reviewed.first_violation.description,/Uniform violation/)
  assert.throws(()=>studentAccount.reviewStudentAccount({...draft,incident_date:'2020-01-01'}),/today's date/)
  assert.throws(()=>studentAccount.reviewStudentAccount({...draft,guardian_phone_number:'0917-123-4567'}),/must be different/)
})

test('invalid student details cannot reach the account review', () => {
  const valid={student_number:'02000123456',first_name:'Juan',last_name:'Santos',middle_name:'',suffix:'',email:'student@gmail.com',academic_level:'COLLEGE',program:'BSIT',section:'A103',year_level:'1',phone_number:'09171234567',guardian_name:'Maria Santos',guardian_relationship:'Mother',guardian_phone_number:'09187654321'}
  for(const change of [{student_number:'123'}, {first_name:''}, {first_name:'Juan123'}, {middle_name:'123'}, {suffix:'Unknown'}, {email:'student@yahoo.com'}, {academic_level:''}, {program:''}, {section:''}, {year_level:9}, {phone_number:'123'}, {guardian_name:''}, {guardian_relationship:''}])assert.throws(()=>studentAccount.reviewStudentAccount({...valid,...change}))
})

test('Gmail correction sends only the new Gmail, reason, and current credential without emailing', async () => {
  const requests=[]
  const result=await studentAccount.correctStudentCredentialsGmail({apiUrl:'https://api.example.test',token:'test-session',studentId:55,email:' New@GMAIL.COM ',reason:' Corrected typo ',password:'Old!Password123',fetchImpl:async(url,options)=>{
    requests.push({url,options});return{ok:true,json:async()=>({success:true,student:{id:55,email:'new@gmail.com'},account:{username:'02000123456'},temporary_password:'New!Password123'})}
  }})
  assert.equal(requests.length,1)
  assert.equal(requests[0].options.method,'PATCH')
  assert.equal(requests[0].url,'https://api.example.test/api/students/55/credentials-email')
  assert.deepEqual(JSON.parse(requests[0].options.body),{email:'new@gmail.com',reason:'Corrected typo',temporary_password:'Old!Password123'})
  assert.equal(result.temporary_password,'New!Password123')
})
