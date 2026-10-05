import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidStudentGmail, normalizeStudentGmail, sendStudentCredentialsEmail } from '../src/lib/studentAccount.js'

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
