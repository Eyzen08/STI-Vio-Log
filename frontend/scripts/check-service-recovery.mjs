import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../../.cache/service-recovery-release/browser/', import.meta.url))
await mkdir(output, { recursive: true })
const server = await createServer({ root, cacheDir: `${output}vite`, server: { host:'127.0.0.1',port:0 }, define:{ 'import.meta.env.PROD':'true', 'import.meta.env.VITE_GOOGLE_CLIENT_ID':JSON.stringify('') } })
await server.listen()
const origin = server.resolvedUrls.local[0]
const browser = await chromium.launch({ channel:'msedge',headless:true })
const errors = []
const student = { id:7,user_id:7,first_name:'Maria',last_name:'Santos',student_number:'2024-001',academic_level:'COLLEGE',program:'BSIT',section:'A',year_level:'1',email:'fixture@example.test' }
const payload = { success:true,student,students:[student],violations:[],violationTypes:[],assignments:[],sessions:[],notifications:[],summary:{unread:0},results:[],destinations:[],clearanceRecords:[],data:[],unread_total:0 }
try {
  for (const theme of ['light','dark']) {
    const context = await browser.newContext({ bypassCSP:true,viewport:{width:390,height:844},reducedMotion:'reduce' })
    let ready = false, healthCalls = 0, loginCalls = 0, reply = 'proxy'
    await context.addInitScript(theme => localStorage.setItem('sti-vio-log-theme',theme),theme)
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/health') { healthCalls++; return route.fulfill(ready ? {json:{success:true,status:'ok',database:'connected'}} : { status:503,contentType:'text/html',body:'<html>Starting</html>' }) }
      if (path === '/api/login') {
        loginCalls++
        return route.fulfill(reply === 'proxy' ? {status:503,contentType:'text/html',body:'<html>Gateway unavailable</html>'} : {status:401,json:{success:false,error:{code:'AUTH_REQUIRED',message:'Invalid username or password'}}})
      }
      return route.fulfill({json:payload})
    })
    const page = await context.newPage(); page.on('pageerror',error => errors.push(error.message))
    await page.goto(`${origin}login`)
    await page.getByRole('heading',{name:'Welcome Back',exact:true}).waitFor()
    await page.locator('#username').fill('student.fixture'); await page.locator('#password').fill('Fixture!Password123')
    await page.getByRole('button',{name:'Sign In',exact:true}).click()
    await page.getByText(/service is starting or reconnecting/).waitFor()
    assert.equal(loginCalls,0)
    assert.equal(await page.locator('#username').inputValue(),'student.fixture')
    await page.screenshot({path:`${output}${theme}-startup.png`,fullPage:true})
    ready=true
    await page.getByRole('alert').filter({hasText:'temporarily unavailable'}).waitFor()
    assert.equal(loginCalls,1); assert.ok(healthCalls>=2)
    assert.equal(await page.locator('#username').getAttribute('aria-invalid'),'false')
    assert.equal(await page.locator('#password').inputValue(),'Fixture!Password123')
    await page.waitForTimeout(1200); assert.equal(loginCalls,1,'ambiguous login is never replayed')
    reply='credentials'
    await page.getByRole('button',{name:'Sign In',exact:true}).click()
    await page.getByRole('alert').filter({hasText:'Invalid username or password'}).waitFor()
    assert.equal(loginCalls,2); assert.equal(await page.locator('#username').getAttribute('aria-invalid'),'true')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await context.close()
  }

  for (const role of ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD','STUDENT']) {
    const context = await browser.newContext({bypassCSP:true,viewport:{width:1440,height:900}})
    const user = { id:7,username:'fixture',role,first_name:'Maria',last_name:'Santos' }
    let attendanceFailure=false, unrelatedFailure=false, attendanceCalls=0
    const attendancePath = role === 'STUDENT' ? '/api/students/me/community-service/dtr' : '/api/community-service/active-sessions'
    await context.addInitScript(user => localStorage.setItem('sti_vio_log_user',JSON.stringify(user)),user)
    await context.route('**/api/**',async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/session') return route.fulfill({json:{success:true,user}})
      if (path === '/api/auth/legal') return route.fulfill({json:{legal:{required:false}}})
      if (path === attendancePath) {
        attendanceCalls++
        if (attendanceFailure) return route.fulfill({status:503,contentType:'text/html',body:'<html>Bad gateway</html>'})
      }
      if (unrelatedFailure && path === (role === 'STUDENT' ? '/api/students/me' : '/api/community-service')) return route.fulfill({status:503,json:{success:false,message:'Unrelated fixture unavailable'}})
      return route.fulfill({json:payload})
    })
    const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message))
    const prefix = role === 'STUDENT' ? 'student' : role === 'DEPARTMENT_HEAD' ? 'department' : 'admin'
    await page.goto(`${origin}${prefix}/dashboard`)
    await page.locator('.attendance-sync').filter({hasText:'Last synced'}).waitFor()
    const initial=attendanceCalls; unrelatedFailure=true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(400)
    assert.ok(attendanceCalls>initial)
    assert.equal(await page.locator('.attendance-sync--warning').count(),0,'unrelated data failure cannot stale attendance')
    attendanceFailure=true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.getByRole('button',{name:'Retry Attendance',exact:true}).waitFor()
    assert.match(await page.locator('.attendance-sync').textContent(),/Last loaded attendance may be outdated/)
    await page.screenshot({path:`${output}${role}-stale.png`,fullPage:true})
    attendanceFailure=false
    await page.getByRole('button',{name:'Retry Attendance',exact:true}).click()
    await page.locator('.attendance-sync--warning').waitFor({state:'hidden'})
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    assert.match(await page.locator('.attendance-sync').textContent(),/Offline/)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(200)
    assert.doesNotMatch(await page.locator('.attendance-sync').textContent(),/Offline/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth))
    await page.screenshot({path:`${output}${role}-recovered.png`,fullPage:true})
    await context.close()
  }
  assert.deepEqual(errors,[])
  console.log('PASS: both login themes retain drafts through startup, submit once, distinguish credentials from service failures; all four roles isolate attendance, retain sync snapshots, retry and recover online without overflow.')
} finally { await browser.close(); await server.close() }
