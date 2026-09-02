import test from 'node:test'
import assert from 'node:assert/strict'
import { registrationErrors, registrationStepIsValid } from '../src/lib/studentRegistration.js'

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
