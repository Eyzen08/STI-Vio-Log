// Run with a local Vite server on port 5174 and Playwright available on NODE_PATH.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ channel:'msedge', headless:true })
const base = 'http://127.0.0.1:5174'
const artifacts = new URL('../artifacts/account-setup/',import.meta.url)
await mkdir(artifacts,{recursive:true})
const initialUser={id:90001,role:'STUDENT',username:'02000123456',full_name:'Setup Test Student',password_change_required:false,onboarding_required:true,onboarding_step:'GOOGLE',google_onboarding_stage:'EMAIL',onboarding_google_email:'student.with.a.long.address.for.layout.checking@gmail.com'}

async function scenario(user=initialUser,{legalRequired=false,width=390}={}) {
  const context=await browser.newContext({viewport:{width,height:844},bypassCSP:true})
  const state={user:{...user},legalRequired,emailRequests:0,profileAttempts:0,profiles:[],rejectGoogle:true,credentialEmails:0,createdStudent:null}
  await context.addInitScript(user=>{
    if(user&&!sessionStorage.getItem('setup-test-seeded')){localStorage.setItem('sti_vio_log_user',JSON.stringify(user));sessionStorage.setItem('setup-test-seeded','true')}
    window.google={accounts:{id:{initialize(config){window.setupGoogleCallback=config.callback},renderButton(node){const button=document.createElement('button');button.textContent='Continue with Google';button.onclick=()=>window.setupGoogleCallback({credential:'test-google-credential'});node.append(button)}}}}
  },user)
  await context.route('**/socket.io/**',route=>route.abort())
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    const body=route.request().postDataJSON()
    let status=200,data={success:true,students:[],departments:[],violations:[],assignments:[],notifications:[],records:[],summary:{unread:0}}
    const session=()=>({success:true,user:{...state.user},csrf_token:'test-csrf'})
    if(path==='/api/auth/session')data=session()
    else if(path==='/api/login')data=session()
    else if(path==='/api/auth/csrf')data={csrf_token:'test-csrf'}
    else if(path==='/api/auth/legal')data={legal:{required:state.legalRequired,acknowledgment_version:'test',terms_version:'test',privacy_notice_version:'test'}}
    else if(path==='/api/auth/legal/acknowledge'){state.legalRequired=false;data={legal:{required:false}}}
    else if(path==='/api/account/password-change'){state.user.password_change_required=false;state.user.onboarding_step='GOOGLE';data=session()}
    else if(path.endsWith('/google-email/request')){state.emailRequests++;state.user.google_onboarding_stage='OTP';data=session()}
    else if(path.endsWith('/google-email/verify')){
      if(body.code!=='123456'){status=400;data={message:'The code is invalid or expired.'}}
      else{state.user.google_onboarding_stage='OAUTH';data=session()}
    }else if(path.endsWith('/google-link')){
      if(state.rejectGoogle){state.rejectGoogle=false;status=409;data={message:'Use the same Google account as your verified Gmail.'}}
      else{state.user.onboarding_step='PROFILE';data=session()}
    }else if(path.endsWith('/student-onboarding/profile')){
      state.profileAttempts++;state.profiles.push(body)
      if(state.profileAttempts===1){status=503;data={message:'Unable to save right now. Try again.'}}
      else{state.user.onboarding_required=false;state.user.onboarding_step='COMPLETE';data=session()}
    }else if(path==='/api/students/me')data={student:{student_number:'02000123456',first_name:'Setup',last_name:'Student'}}
    else if(path==='/api/students'&&route.request().method()==='POST'){
      state.createdStudent={id:55,...body}
      data={success:true,student:state.createdStudent,account:{username:body.student_number},temporary_password:'Temporary!Pass123'}
    }else if(path==='/api/students')data={students:state.createdStudent?[state.createdStudent]:[]}
    else if(path==='/api/students/55/credentials-email'){
      if(route.request().method()==='PATCH'){
        state.createdStudent.email=body.email
        data={success:true,student:state.createdStudent,account:{username:state.createdStudent.student_number},temporary_password:'Corrected!Pass123'}
      }else{
        state.credentialEmails++
        if(state.credentialEmails===1){status=503;data={message:'Email unavailable'}}
        else data={success:true,email_status:'sent'}
      }
    }else if(path==='/api/students/55/password-reset')data={success:true,account:{username:'02000123456'},temporary_password:'Reissued!Pass123'}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
  })
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  return {context,page,state,errors}
}
const visible=async(locator)=>{await locator.waitFor({state:'visible'});assert.equal(await locator.isVisible(),true)}
const noChrome=async(page)=>{
  assert.equal(await page.locator('#portal-navigation,.mobile-bottom-nav,.notification-button').count(),0)
  assert.equal(await page.locator('main').count(),1)
  assert.equal(await page.locator('#main-content').count(),1)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)
  assert.doesNotMatch(await page.title(),/Page Not Found/)
}
const snapshot=async(page,name)=>{
  await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-transitioning'))
  return page.screenshot({path:new URL(name+'.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true})
}

try {
  const flow=await scenario()
  const {page,state}=flow
  await page.goto(base+'/student/dashboard')
  await visible(page.getByRole('heading',{name:'Confirm your Gmail'}))
  assert.equal(new URL(page.url()).pathname,'/student/onboarding')
  await noChrome(page)
  const bounds=await page.getByRole('button',{name:'Send verification code',exact:true}).boundingBox()
  assert.ok(bounds.y+bounds.height<844,'Active Gmail action fits in mobile viewport')
  await snapshot(page,'mobile-google-email')
  await page.getByRole('button',{name:'Send verification code',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Check your inbox'}))
  assert.equal(state.emailRequests,1)
  assert.equal(await page.getByRole('button',{name:/Resend code in/}).isDisabled(),true)
  await page.getByRole('link',{name:'Privacy Notice',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Privacy Notice',exact:true}))
  await page.getByRole('button',{name:'Return',exact:true}).first().click()
  await visible(page.getByRole('heading',{name:'Check your inbox'}))
  assert.equal(await page.getByRole('button',{name:/Resend code in/}).isDisabled(),true)
  for(let i=1;i<=6;i++)await page.locator('#google-email-code-'+i).fill('9')
  await page.getByRole('button',{name:'Verify email and continue'}).click()
  await visible(page.getByRole('alert'))
  assert.match(await page.getByRole('alert').innerText(),/invalid or expired/)
  for(let i=1;i<=6;i++)await page.locator('#google-email-code-'+i).fill(String(i))
  await page.getByRole('button',{name:'Verify email and continue'}).click()
  await visible(page.getByRole('heading',{name:'Link your Google account'}))
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click()
  await visible(page.getByRole('alert'))
  assert.match(await page.getByRole('alert').innerText(),/same Google account/)
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Add your academic details'}))
  await noChrome(page)
  await page.getByRole('button',{name:'Continue to contact details'}).click()
  assert.equal(await page.getByRole('heading',{name:'Add your academic details'}).isVisible(),true)
  assert.equal(state.profileAttempts,0)
  await page.getByLabel('Program').selectOption('BSIT')
  await page.getByLabel('Year level').selectOption('3')
  await page.getByLabel('Section',{exact:true}).fill('BSIT-3A')
  await snapshot(page,'mobile-academic')
  await page.getByRole('button',{name:'Continue to contact details'}).click()
  await visible(page.getByRole('heading',{name:'Add contact and guardian details'}))
  await page.getByLabel('Your mobile number',{exact:true}).fill('09171234567')
  await page.getByLabel('Guardian’s full name',{exact:true}).fill('Maria Dela Cruz')
  await page.getByLabel('Relationship to you',{exact:true}).fill('Mother')
  await page.getByLabel('Guardian’s mobile number',{exact:true}).fill('09181234567')
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Add your academic details'}))
  assert.equal(await page.getByLabel('Program').inputValue(),'BSIT')
  assert.equal(await page.getByLabel('Section',{exact:true}).inputValue(),'BSIT-3A')
  await page.getByRole('link',{name:'Terms of Use',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Terms of Use',exact:true}))
  await page.getByRole('button',{name:'Return',exact:true}).first().click()
  await visible(page.getByRole('heading',{name:'Add your academic details'}))
  assert.equal(await page.getByLabel('Section',{exact:true}).inputValue(),'BSIT-3A')
  await page.getByRole('button',{name:'Continue to contact details'}).click()
  await visible(page.getByRole('heading',{name:'Add contact and guardian details'}))
  assert.equal(await page.getByLabel('Guardian’s full name',{exact:true}).inputValue(),'Maria Dela Cruz')
  await snapshot(page,'mobile-contact')
  await page.getByRole('button',{name:/Switch to dark mode/}).click()
  await snapshot(page,'mobile-contact-dark')
  await page.getByRole('button',{name:'Save and finish setup',exact:true}).click()
  await visible(page.getByRole('alert'))
  assert.match(await page.getByRole('alert').innerText(),/Unable to save/)
  assert.equal(await page.getByLabel('Guardian’s full name',{exact:true}).inputValue(),'Maria Dela Cruz')
  assert.equal(await page.getByRole('alert').evaluate(node=>node===document.activeElement),true)
  await page.getByRole('button',{name:'Save and finish setup',exact:true}).click()
  await visible(page.getByRole('heading',{name:'Your account is ready'}))
  assert.equal(state.profileAttempts,2)
  assert.equal(state.profiles[1].phone_number,'+639171234567')
  assert.equal(state.profiles[1].guardian_phone_number,'+639181234567')
  assert.equal(state.profiles[1].year_level,3)
  assert.equal(state.profiles[1].student_number,undefined)
  await noChrome(page)
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sti_vio_log_user')).onboarding_required),false)
  await snapshot(page,'mobile-complete-dark')
  await page.getByRole('button',{name:'Open student portal'}).click()
  await page.waitForURL('**/student/dashboard')
  await visible(page.locator('.mobile-bottom-nav'))
  await page.goto(base+'/student/onboarding')
  await page.waitForURL('**/student/dashboard')
  assert.deepEqual(flow.errors,[])
  await flow.context.close()
  console.log('PASS Google stages, error recovery, mobile layout, Back, policy return, complete payload and success screen')

  const senior=await scenario({...initialUser,onboarding_step:'PROFILE'},{width:1280})
  await senior.page.goto(base+'/student/onboarding')
  await visible(senior.page.getByRole('heading',{name:'Add your academic details'}))
  await senior.page.getByLabel('Program').selectOption('BSIT')
  await senior.page.getByLabel('Year level').selectOption('3')
  await senior.page.getByRole('radio',{name:'Senior High School',exact:true}).check()
  assert.equal(await senior.page.getByLabel('Program').count(),0)
  assert.deepEqual(await senior.page.getByLabel('Grade level').locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),['','11','12'])
  await senior.page.getByLabel('Strand').selectOption('STEM')
  await senior.page.getByLabel('Grade level').selectOption('12')
  await senior.page.getByLabel('Section',{exact:true}).fill('STEM-12A')
  await noChrome(senior.page)
  await snapshot(senior.page,'desktop-academic-senior-high')
  await senior.page.getByRole('button',{name:/Switch to dark mode/}).click()
  await snapshot(senior.page,'desktop-academic-senior-high-dark')
  await senior.page.getByRole('button',{name:'Continue to contact details'}).click()
  await visible(senior.page.getByRole('heading',{name:'Add contact and guardian details'}))
  await senior.page.reload()
  await visible(senior.page.getByRole('heading',{name:'Add your academic details'}))
  assert.equal(await senior.page.getByLabel('Section',{exact:true}).inputValue(),'')
  await senior.page.getByRole('button',{name:'Sign out',exact:true}).click()
  await visible(senior.page.getByRole('dialog'))
  await senior.page.getByRole('button',{name:'Logout',exact:true}).click()
  await senior.page.waitForURL('**/login')
  await visible(senior.page.getByRole('heading',{name:'Sign In',exact:true}))
  assert.equal(await senior.page.evaluate(()=>localStorage.getItem('sti_vio_log_user')),null)
  await senior.context.close()
  console.log('PASS College/Senior High switching, desktop themes, refresh clears draft and logout')

  const password=await scenario({...initialUser,password_change_required:true,onboarding_step:'PASSWORD'},{legalRequired:true})
  await password.page.goto(base+'/account/password-change')
  await visible(password.page.getByRole('heading',{name:'Create your own password'}))
  await noChrome(password.page)
  await snapshot(password.page,'mobile-password')
  await password.page.getByLabel('Current or temporary password',{exact:true}).fill('Temporary!Pass123')
  await password.page.getByLabel('New password',{exact:true}).fill('Updated!Pass123')
  await password.page.getByLabel('Confirm new password',{exact:true}).fill('Different!Pass123')
  await visible(password.page.getByText('Passwords do not match yet.'))
  await password.page.getByRole('button',{name:'Save password and continue'}).click()
  await visible(password.page.getByRole('alert'))
  await password.page.getByLabel('Confirm new password',{exact:true}).fill('Updated!Pass123')
  await password.page.getByRole('button',{name:'Save password and continue'}).click()
  await visible(password.page.getByRole('heading',{name:'Review the Terms of Use'}))
  await noChrome(password.page)
  await password.page.getByRole('button',{name:'Acknowledge Terms and continue'}).click()
  await visible(password.page.getByRole('heading',{name:'Confirm your Gmail'}))
  await password.context.close()
  console.log('PASS Password confirmation, security precedence and Terms acknowledgment')

  const office=await scenario({id:90002,role:'DISCIPLINE_OFFICE',username:'test.officer',password_change_required:false,onboarding_required:false},{width:1280})
  await office.page.goto(base+'/admin/students')
  await visible(office.page.getByRole('heading',{name:'Student Management'}))
  await office.page.getByRole('button',{name:'Add Student',exact:true}).click()
  await office.page.locator('#create-student-student_number').fill('02000123456')
  await office.page.locator('#create-student-first_name').fill('Test')
  await office.page.locator('#create-student-last_name').fill('Student')
  await office.page.locator('#create-student-email').fill('test.student@gmail.com')
  await office.page.getByRole('button',{name:'Review Details',exact:true}).click()
  await visible(office.page.getByRole('heading',{name:'Review student details'}))
  await office.page.getByRole('button',{name:'Confirm and Create Account',exact:true}).click()
  await visible(office.page.getByRole('dialog',{name:'Temporary student credentials'}))
  assert.equal(office.state.credentialEmails,0)
  await office.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied')}}}))
  await office.page.getByRole('button',{name:'Copy temporary password',exact:true}).click()
  await visible(office.page.getByText('Could not copy. Select the temporary password above and copy it manually.'))
  await office.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.setupCopied=text}}}))
  await office.page.getByRole('button',{name:'Copy student number',exact:true}).click()
  assert.equal(await office.page.evaluate(()=>window.setupCopied),'02000123456')
  await office.page.getByRole('button',{name:'Edit Gmail',exact:true}).click()
  await office.page.locator('.student-credentials-edit input').fill('corrected.student@gmail.com')
  await office.page.getByLabel('Reason for correction').fill('Corrected recorded address')
  await office.page.getByRole('button',{name:'Save Gmail',exact:true}).click()
  await visible(office.page.getByText('Corrected!Pass123',{exact:true}))
  assert.equal(office.state.credentialEmails,0)
  await snapshot(office.page,'desktop-office-credentials')
  await office.page.getByRole('button',{name:'Send Email',exact:true}).click()
  await visible(office.page.getByRole('button',{name:'Retry Email',exact:true}))
  await office.page.getByRole('button',{name:'Retry Email',exact:true}).click()
  await visible(office.page.getByText(/Email sent to corrected.student@gmail.com/))
  assert.equal(office.state.credentialEmails,2)
  await office.page.getByRole('button',{name:'I stored it securely',exact:true}).click()
  await office.page.getByRole('button',{name:'More actions for Test Student',exact:true}).click()
  await office.page.getByRole('menuitem',{name:'Issue password',exact:true}).click()
  await office.page.getByLabel('Required reason').fill('Student requested recovery')
  await office.page.getByRole('button',{name:'Confirm action',exact:true}).click()
  await visible(office.page.getByText('Reissued!Pass123',{exact:true}))
  await office.page.getByRole('button',{name:'Copy temporary password',exact:true}).click()
  assert.equal(await office.page.evaluate(()=>window.setupCopied),'Reissued!Pass123')
  await office.context.close()
  console.log('PASS DO create/reissue, clipboard feedback, Gmail correction and explicit email retries')
} finally {
  await browser.close()
}
