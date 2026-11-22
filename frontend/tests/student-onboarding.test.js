import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
const onboarding=readFileSync(new URL('../src/components/StudentOnboarding.jsx',import.meta.url),'utf8')
const progress=readFileSync(new URL('../src/components/OnboardingProgress.jsx',import.meta.url),'utf8')
const api=readFileSync(new URL('../src/lib/api.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/styles/account-setup.css',import.meta.url),'utf8')

test('mandatory Student onboarding renders before portal content and resumes by session state',()=>{
  assert.match(app,/user\?\.role==='STUDENT' && \(user\?\.onboarding_required \|\| showOnboardingComplete\)/)
  assert.match(app,/data\.user\.onboarding_required \|\| onboardingComplete \? '\/student\/onboarding'/)
  assert.match(progress,/Password.*Google.*Student Details.*Ready/s)
});

test('onboarding binds Google first and reviews official student details without writing them',()=>{
  assert.match(onboarding,/step==='GOOGLE'/)
  assert.match(api,/student-onboarding\/google-link/)
  assert.match(api,/student-onboarding\/google-email\/request/)
  assert.match(api,/student-onboarding\/google-email\/verify/)
  assert.match(onboarding,/Google Account Email<\/span><strong>\{email/)
  assert.doesNotMatch(onboarding,/type="email"/)
  assert.match(onboarding,/Gmail recorded by the Discipline Office/);assert.doesNotMatch(onboarding,/Use another email/)
  assert.match(onboarding,/Email.*Verification Code.*Google Sign-In/s)
  assert.match(onboarding,/<OtpInput id="google-email-code"/)
  assert.match(api,/student-onboarding\/profile/)
  assert.match(onboarding,/apiRequest\('\/api\/students\/me'/)
  assert.match(onboarding,/completeStudentOnboarding\(\{\}\)/)
  assert.doesNotMatch(onboarding,/academic_level:/)
  assert.doesNotMatch(onboarding,/guardian_name:/)
  assert.doesNotMatch(onboarding,/student_number:/)
  assert.match(onboarding,/managed by the Discipline Office and cannot be edited here/)
});

test('Discipline Office creation collects the full official profile and optional first violation',()=>{
  assert.match(app,/useState\(emptyStudentForm\)/)
  for(const field of ['student_number','first_name','middle_name','last_name','suffix','email','include_first_violation','violation_type_id','incident_date','incident_time','exact_offense','incident_details'])assert.match(app,new RegExp(field))
  assert.match(app,/<StudentAcademicFields value=\{studentForm\}/)
  assert.match(app,/<PhoneInput id="create-student-phone"/)
  assert.match(app,/<PhoneInput id="create-student-guardian-phone"/)
  assert.match(app,/official student information managed by the Discipline Office/)
  const formState=app.slice(app.indexOf('const [studentForm'),app.indexOf('const [studentFormError'))
  for(const field of ['qr_code','profile_image'])assert.doesNotMatch(formState,new RegExp(field))
});

test('onboarding layout is responsive, keyboard-semantic, and dark-theme aware',()=>{
  assert.match(progress,/aria-label="Student Account Setup Progress"/)
  assert.match(css,/@media\(max-width:600px\).*\.onboarding-progress/s)
  assert.match(css,/var\(--surface-raised\)/)
  assert.match(css,/var\(--text-primary\)/)
});

test('academic and guardian details are displayed read-only from the official student profile',()=>{
  assert.match(onboarding,/academicLevelLabel\(profile\)/)
  assert.match(onboarding,/academicProgram\(profile\)/)
  assert.match(onboarding,/academicYear\(profile\)/)
  assert.match(onboarding,/profile\.section/)
  assert.match(onboarding,/profile\.guardian_name/)
  assert.match(onboarding,/profile\.guardian_phone_number/)
  assert.doesNotMatch(onboarding,/role="radiogroup"/)
  assert.doesNotMatch(onboarding,/form\.academicLevel/)
  assert.doesNotMatch(onboarding,/yearOptions/)
  assert.match(css,/\.onboarding-academic-grid \{ display:grid; grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css,/@media\(min-width:600px\).*\.onboarding-academic-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s)
});
