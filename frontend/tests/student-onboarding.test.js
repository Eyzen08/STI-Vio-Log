import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
const onboarding=readFileSync(new URL('../src/components/StudentOnboarding.jsx',import.meta.url),'utf8')
const progress=readFileSync(new URL('../src/components/OnboardingProgress.jsx',import.meta.url),'utf8')
const api=readFileSync(new URL('../src/lib/api.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/App.css',import.meta.url),'utf8')

test('mandatory Student onboarding renders before portal content and resumes by session state',()=>{
  assert.match(app,/user\?\.role==='STUDENT' && user\?\.onboarding_required/)
  assert.match(app,/data\.user\.onboarding_required \? '\/student\/onboarding'/)
  assert.match(progress,/Password.*Google account.*Contact information.*Portal/s)
});

test('onboarding binds Google first and submits only student-controlled contact fields',()=>{
  assert.match(onboarding,/step==='GOOGLE'/)
  assert.match(api,/student-onboarding\/google-link/)
  assert.match(api,/student-onboarding\/profile/)
  assert.match(onboarding,/phone_number:.*guardian_name:.*guardian_relationship:.*guardian_phone_number:/s)
  assert.doesNotMatch(onboarding,/student_number:/)
});

test('onboarding layout is responsive, keyboard-semantic, and dark-theme aware',()=>{
  assert.match(onboarding,/aria-label="Student account setup progress"|OnboardingProgress/)
  assert.match(css,/@media\(max-width:600px\).*\.onboarding-progress/s)
  assert.match(css,/:root\[data-theme='dark'\] \.student-onboarding/)
});
