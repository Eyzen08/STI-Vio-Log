import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { displayPhilippinePhone, formatPhilippinePhone, normalizePhilippinePhone, philippineMobileDigits } from '../src/lib/phone.js'
import { totpSecondsRemaining } from '../src/lib/totpCountdown.js'

test('Philippine mobile input strips non-digits, formats, and normalizes to E.164',()=>{
  assert.equal(philippineMobileDigits('+63 917 ABC 123 4567'),'9171234567')
  assert.equal(formatPhilippinePhone('09171234567'),'+63 917 123 4567')
  assert.equal(normalizePhilippinePhone('+63 917 123 4567'),'+639171234567')
  assert.equal(normalizePhilippinePhone('08171234567'),null)
  assert.equal(displayPhilippinePhone('legacy-value'),'legacy-value')
})

test('TOTP countdown follows a 30-second boundary',()=>{
  assert.equal(totpSecondsRemaining(0,30),30)
  assert.equal(totpSecondsRemaining(1_000,30),29)
  assert.equal(totpSecondsRemaining(29_999,30),1)
  assert.equal(totpSecondsRemaining(30_000,30),30)
})

test('authentication drafts and logout confirmation are owned by the app shell',async()=>{
  const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app,/EMPTY_AUTH_DRAFT/)
  assert.match(app,/returnPath=\{authReturnPath\}/)
  assert.match(app,/title="Confirm logout"/)
  assert.match(app,/onLogout=\{requestLogout\}/)
})
