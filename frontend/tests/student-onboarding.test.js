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
  assert.match(onboarding,/placeholder="@gmail\.com"/)
  assert.match(onboarding,/Use personal Gmail only\. Microsoft Entra ID\/School emails \(@sti\.edu\.ph\) are not supported yet\./)
  assert.match(onboarding,/Email.*Verification code.*Google sign-in/s)
  assert.match(onboarding,/<OtpInput id="google-email-code"/)
  assert.match(api,/student-onboarding\/profile/)
  assert.match(onboarding,/program:.*section:.*year_level:.*phone_number:.*guardian_name:.*guardian_relationship:.*guardian_phone_number:/s)
  assert.doesNotMatch(onboarding,/student_number:/)
});

test('Discipline Office creation collects identity and Gmail and leaves QR generation to the server',()=>{
  const start=app.indexOf('const [studentForm')
  const end=app.indexOf('const [studentFormError',start)
  const formState=app.slice(start,end)
  for(const field of ['student_number','first_name','middle_name','last_name','suffix','email'])assert.match(formState,new RegExp(field))
  for(const field of ['phone_number','program','section','year_level','qr_code','profile_image'])assert.doesNotMatch(formState,new RegExp(field))
  assert.match(app,/Enter the Student Number, official legal name, and personal Gmail address/)
});

test('onboarding layout is responsive, keyboard-semantic, and dark-theme aware',()=>{
  assert.match(onboarding,/aria-label="Student account setup progress"|OnboardingProgress/)
  assert.match(css,/@media\(max-width:600px\).*\.onboarding-progress/s)
  assert.match(css,/:root\[data-theme='dark'\] \.student-onboarding/)
});

test('academic onboarding switches levels and keeps mode-specific fields and year ranges',()=>{
  assert.match(onboarding,/role="radiogroup" aria-labelledby="onboarding-academic-level-label"/)
  assert.match(onboarding,/form\.academicLevel==='COLLEGE'&&<label className="onboarding-program-field">Program/)
  assert.match(onboarding,/\.\.\.\(form\.academicLevel==='SENIOR_HIGH_SCHOOL'\?\{academic_level:form\.academicLevel\}:\{\}\)/)
  assert.match(onboarding,/yearLevel:''\}\)\);setError\(''\)/)
  assert.match(onboarding,/\[\[1,'1st Level'\],\[2,'2nd Level'\],\[3,'3rd Level'\],\[4,'4th Level'\]\]/)
  assert.match(onboarding,/\[\[11,'Grade 11'\],\[12,'Grade 12'\]\]/)
  assert.match(onboarding,/<select value=\{form\.yearLevel\}/)
  assert.match(css,/\.onboarding-academic-grid\{display:grid;grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css,/@media\(min-width:900px\)\{\.onboarding-academic-grid\{grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,\.85fr\)\}\}/)
});
