import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordIsStrong, passwordRequirements } from '../src/lib/passwordPolicy.js'

test('frontend password requirements mirror the backend contract',()=>{
  assert.equal(passwordIsStrong('Password@123'),true)
  assert.equal(passwordIsStrong('password@123'),false)
  assert.equal(passwordIsStrong('Password@Test'),false)
  assert.equal(passwordIsStrong('Password123'),false)
  assert.deepEqual(passwordRequirements('Password@123'),{length:true,uppercase:true,number:true,special:true})
})
