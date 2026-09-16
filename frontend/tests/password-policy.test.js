import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordIsStrong, passwordRequirements } from '../src/lib/passwordPolicy.js'

test('frontend password requirements mirror the backend contract',()=>{
  assert.equal(passwordIsStrong('UniquePass@1234'),true)
  assert.equal(passwordIsStrong('password@123'),false)
  assert.equal(passwordIsStrong('Password@Test'),false)
  assert.equal(passwordIsStrong('Password123'),false)
  assert.deepEqual(passwordRequirements('UniquePass@1234'),{length:true,uppercase:true,number:true,special:true,uncommon:true})
})
