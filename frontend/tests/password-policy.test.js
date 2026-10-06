import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { passwordIsStrong, passwordRequirements } from '../src/lib/passwordPolicy.js'

test('frontend password requirements mirror the backend contract',()=>{
  assert.equal(passwordIsStrong('UniquePass@1234'),true)
  assert.equal(passwordIsStrong('password@123'),false)
  assert.equal(passwordIsStrong('Password@Test'),false)
  assert.equal(passwordIsStrong('Password123'),false)
  assert.deepEqual(passwordRequirements('UniquePass@1234'),{length:true,uppercase:true,number:true,special:true,uncommon:true})
})

test('frontend accepts 8-128 characters without relaxing complexity',()=>{
  for(const length of [7,8,9,11,12,128,129]){
    const password='Aa1!'+'x'.repeat(length-4)
    const accepted=length>=8&&length<=128
    assert.equal(passwordRequirements(password).length,accepted,`length ${length}`)
    assert.equal(passwordIsStrong(password),accepted,`length ${length}`)
  }
  for(const password of ['aa1!xxxx','Aaaa!xxx','Aaa1xxxx','Admin123!']){
    assert.equal(passwordRequirements(password).length,true)
    assert.equal(passwordIsStrong(password),false,password)
  }
})

test('password indicator and input document the 8-character minimum',async()=>{
  const indicator=await readFile(new URL('../src/components/PasswordRequirements.jsx',import.meta.url),'utf8')
  const field=await readFile(new URL('../src/components/PasswordField.jsx',import.meta.url),'utf8')
  assert.match(indicator,/\['length', '8 or more characters'\]/)
  assert.match(field,/minLength="8" maxLength="128"/)
})
