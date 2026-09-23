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

test('onboarding binds Google first and submits only student-controlled academic and contact fields',()=>{
  assert.match(onboarding,/step==='GOOGLE'/)
  assert.match(api,/student-onboarding\/google-link/)
  assert.match(api,/student-onboarding\/google-email\/request/)
  assert.match(api,/student-onboarding\/google-email\/verify/)
  assert.match(onboarding,/Email.*Verification code.*Google sign-in/s)
  assert.match(onboarding,/<OtpInput id="google-email-code"/)
  assert.match(api,/student-onboarding\/profile/)
  assert.match(onboarding,/program:.*section:.*year_level:.*phone_number:.*guardian_name:.*guardian_relationship:.*guardian_phone_number:/s)
  assert.doesNotMatch(onboarding,/student_number:/)
});

test('Discipline Office creation collects identity only and leaves QR generation to the server',()=>{
  const start=app.indexOf('const [studentForm')
  const end=app.indexOf('const [studentFormError',start)
  const formState=app.slice(start,end)
  for(const field of ['student_number','first_name','middle_name','last_name','suffix'])assert.match(formState,new RegExp(field))
  for(const field of ['email','phone_number','program','section','year_level','qr_code','profile_image'])assert.doesNotMatch(formState,new RegExp(field))
  assert.match(app,/Enter only the Student Number and official legal name/)
});

test('onboarding layout is responsive, keyboard-semantic, and dark-theme aware',()=>{
  assert.match(onboarding,/aria-label="Student account setup progress"|OnboardingProgress/)
  assert.match(css,/@media\(max-width:600px\).*\.onboarding-progress/s)
  assert.match(css,/:root\[data-theme='dark'\] \.student-onboarding/)
});
