import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRegistrationInput, normalizeRegistration, registrationErrors, registrationStepIsValid } from '../src/lib/studentRegistration.js'

const validRegistration = {
  firstName:'Jose',middleName:'Pedro',lastName:'Reyes',suffix:'',studentNumber:'02000123456',
  email:'student@example.com',phoneNumber:'09171234567',program:'BSIT',section:'A103',yearLevel:'2',
  guardianName:'Maria Reyes',guardianRelationship:'Mother',guardianPhoneNumber:'09181234567',
  password:'Password@123',confirmPassword:'Password@123',
}

test('each registration wizard step validates its own required fields',()=>{
  for(let step=0;step<4;step+=1)assert.equal(registrationStepIsValid(validRegistration,step),true)
})

test('student number accepts only the approved 11-digit format',()=>{
  assert.equal(registrationErrors(validRegistration).studentNumber,'')
  assert.match(registrationErrors({...validRegistration,studentNumber:'02000A23456'}).studentNumber,/exactly 11 digits/)
  assert.match(registrationErrors({...validRegistration,studentNumber:'0200012345'}).studentNumber,/exactly 11 digits/)
})

test('security step requires a strong matching password',()=>{
  assert.equal(registrationStepIsValid({...validRegistration,password:'password',confirmPassword:'password'},3),false)
  assert.equal(registrationStepIsValid({...validRegistration,confirmPassword:'Different@123'},3),false)
})

test('optional middle name and suffix do not block identity completion',()=>{
  assert.equal(registrationStepIsValid({...validRegistration,middleName:'',suffix:''},0),true)
})

test('name fields use title case while preserving spaces, hyphens, and apostrophes',()=>{
  assert.equal(formatRegistrationInput('firstName','jose  pedro santos'),'Jose  Pedro Santos')
  assert.equal(formatRegistrationInput('lastName',"o'connor dela-cruz"),"O'Connor Dela-Cruz")
  assert.equal(formatRegistrationInput('guardianName','mary-jane de leon'),'Mary-Jane De Leon')
  assert.equal(formatRegistrationInput('guardianRelationship','legal guardian'),'Legal Guardian')
})

test('suffix, email, program, and section use their approved formatting',()=>{
  assert.equal(formatRegistrationInput('suffix','jr'),'Jr.')
  assert.equal(formatRegistrationInput('suffix','iii'),'III')
  assert.equal(formatRegistrationInput('email','Student.Name@GMAIL.COM'),'student.name@gmail.com')
  assert.equal(formatRegistrationInput('program','bsit'),'BSIT')
  assert.equal(formatRegistrationInput('section','a602'),'A602')
})

test('submission normalization trims non-sensitive values without altering passwords',()=>{
  const normalized=normalizeRegistration({...validRegistration,firstName:' jose ',email:' TEST@Example.COM ',program:' bsit ',password:' Password@123 '})
  assert.equal(normalized.firstName,'Jose')
  assert.equal(normalized.email,'test@example.com')
  assert.equal(normalized.program,'BSIT')
  assert.equal(normalized.password,' Password@123 ')
})
