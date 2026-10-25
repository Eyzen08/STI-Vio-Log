// Browser fixtures exercise real portal components; persistence is covered by service-attendance.pgtest.js.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium }=createRequire(import.meta.url)('playwright')
const root=fileURLToPath(new URL('../',import.meta.url))
const output=fileURLToPath(new URL('../artifacts/day-invalidation/',import.meta.url))
const server=await createServer({root,cacheDir:`${output}vite-cache`,server:{host:'127.0.0.1',port:0,hmr:false}})
const now=Date.now(),today=new Date(now+8*3600000).toISOString().slice(0,10),past=new Date(now-16*3600000).toISOString().slice(0,10)
const student={id:1,first_name:'Maria',last_name:'Santos',student_number:'2024-001',email_verified:true,program:'BSIT',year_level:2,section:'A303'}
const assignment={assignment_id:19,student_id:1,violation_id:1,department_id:1,department_name:'Library',...student,id:19,required_hours:20,completed_hours:2,remaining_hours:18,status:'IN_PROGRESS'}
const base={...student,student_id:1,assignment_id:19,department_id:1,department_name:'Library',required_hours:20,completed_hours:2,remaining_hours:18,session_type:'OPEN_TIME',server_time:new Date(now).toISOString(),supervising_officer_user_id:2}
const initial=[{...base,id:17,session_id:17,service_date:past,status:'COMPLETED',time_in:`${past}T01:00:00+08:00`,time_out:`${past}T02:00:00+08:00`,worked_minutes:60,credited_minutes:60},
  {...base,id:18,session_id:18,service_date:today,status:'COMPLETED',time_in:`${today}T01:00:00+08:00`,time_out:`${today}T02:00:00+08:00`,worked_minutes:60,credited_minutes:60},
  {...base,id:19,session_id:19,service_date:today,status:'ACTIVE',time_in:new Date(now-3600000).toISOString(),credit_cutoff_at:new Date(now+3600000).toISOString(),paused_at:new Date(now-600000).toISOString(),pause_history:[{id:1,started_at:new Date(now-600000).toISOString(),reason:'Break'}]}]
let browser
try {
  await server.listen();await mkdir(output,{recursive:true})
  const origin=server.resolvedUrls.local[0]
  browser=await chromium.launch({headless:true,channel:'chrome'})
  for(const role of ['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD','STUDENT']) for(const width of [1366,390]) for(const theme of ['light','dark']) {
    const user={id:99,role,full_name:'Test Staff',first_name:'Test',last_name:'Staff',department_id:1,email_verified:true}
    const page=await browser.newPage({viewport:{width,height:900},bypassCSP:true})
    await page.context().addCookies([{name:'sti_csrf',value:'invalidation-fixture',url:origin}])
    const errors=[],invalidated=new Map();let stale=role==='DISCIPLINE_ADMIN',posts=0,previewCount=0,correction=null,sessionLoads=0
    const currentAssignment=()=>({...assignment,completed_hours:correction ?? 2-invalidated.size,remaining_hours:20-(correction ?? 2-invalidated.size)})
    page.on('pageerror',error=>errors.push(error.message))
    const sessions=()=>initial.map(session=>invalidated.has(session.service_date)?{...session,status:'COMPLETED',time_out:session.time_out || new Date(now).toISOString(),day_invalidation_id:1,day_invalidation:invalidated.get(session.service_date),original_credited_minutes:session.credited_minutes || 0,credited_minutes:0,completion_reason:session.time_out?'COMPLETED':'DAY_INVALIDATED',attendance_outcome:'DAY_INVALIDATED'}:session)
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url()),path=url.pathname
      if(!path.startsWith('/api/'))return url.origin===new URL(origin).origin?route.continue():route.abort()
      let status=200
      let body={success:true,students:[student],student,profile:user,assignments:[currentAssignment()],sessions:sessions().filter(session=>session.status==='ACTIVE'),notifications:[],summary:{},destinations:[],departments:[],officers:[],accounts:[],records:[],rows:[],entries:[],logs:[],conversations:[],recipients:[],messages:[],violations:[],violationTypes:[],clearanceRecords:[],results:[],pagination:{page:1,totalPages:1,total:1}}
      if(path==='/api/auth/session')body={user,csrf_token:'invalidation-fixture'}
      if(path==='/api/auth/csrf')body={success:true,csrf_token:'invalidation-fixture'}
      if(path==='/api/auth/legal')body={legal:{required:false}}
      if(path==='/api/community-service/19')body={assignment:currentAssignment()}
      if(path==='/api/community-service/19/sessions'){sessionLoads++;body={sessions:sessions()}}
      if(path==='/api/students/me/community-service/dtr')body={assignments:[{...assignment,required_minutes:1200,credited_minutes:0,remaining_minutes:1200}],sessions:sessions(),hourCorrections:[]}
      if(path.endsWith('/invalidation-preview')) {
        previewCount++
        const date=path.split('/').at(-2),affected=sessions().filter(session=>session.service_date===date)
        body={success:true,assignment,student,service_date:date,sessions:affected,removed_credit_minutes:60,new_completed_hours:1,new_remaining_hours:19,preview_version:(stale?'a':'b').repeat(64)}
      }
      if(path.endsWith('/invalidate')) {
        posts++;const request=route.request().postDataJSON();assert.equal(request.reason,'Student did not return')
        if(stale) {stale=false;status=409;body={success:false,message:'Attendance changed. Review the updated preview.',error:{code:'STALE_DAY_PREVIEW'}}}
        else {
          assert.equal(request.preview_version,'b'.repeat(64))
          const date=path.split('/').at(-2)
          const invalidation={id:1,assignment_id:19,service_date:date,reason:request.reason,performed_by_name:'Test Staff',performed_by_user_id:99,created_at:new Date(now).toISOString(),removed_credit_minutes:60}
          invalidated.set(date,invalidation)
          body={success:true,assignment:currentAssignment(),invalidation,sessions:sessions().filter(session=>session.service_date===date)}
        }
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    })
    await page.addInitScript(({user,theme})=>{localStorage.setItem('sti_vio_log_user',JSON.stringify(user));localStorage.setItem('sti_vio_log_theme',theme)}, {user,theme})
    if(role==='STUDENT')invalidated.set(today,{id:1,assignment_id:19,service_date:today,reason:'Student did not return',performed_by_name:'Test Staff',created_at:new Date(now).toISOString()})
    await page.goto(`${origin}${role==='STUDENT'?'student/community-service':role==='DEPARTMENT_HEAD'?'department/community-service':'admin/active-attendance'}`,{waitUntil:'domcontentloaded'})
    await page.locator('.app-shell').waitFor();await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    if(role==='STUDENT') {
      await page.getByText('Student did not return',{exact:true}).first().waitFor()
      assert.equal(await page.getByRole('button',{name:'Invalidate Day',exact:true}).count(),0)
    } else {
      const button=page.getByRole('button',{name:'Invalidate Day',exact:true}).first();await button.waitFor()
      if(width===390)await button.click();else {await button.focus();await page.keyboard.press('Enter')}
      const dialog=page.getByRole('dialog',{name:'Invalidate Service Day'})
      const confirm=dialog.getByRole('button',{name:'Invalidate Day',exact:true})
      await dialog.getByText('Credit Removed',{exact:true}).waitFor()
      assert.equal(await confirm.isDisabled(),true)
      await dialog.getByLabel('Reason',{exact:false}).fill('   ');assert.equal(await confirm.isDisabled(),true)
      await dialog.getByLabel('Reason',{exact:false}).fill('  Student did not return  ')
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(element=>element.contains(document.activeElement)),true)
      assert.equal(await dialog.evaluate(element=>getComputedStyle(element).boxShadow==='none'),theme==='dark','Dialog elevation follows the theme while content cards stay flat')
      assert.equal(await dialog.evaluate(element=>getComputedStyle(element).borderTopLeftRadius),'10px','Dialogs share the portal card radius')
      const contrast=await dialog.locator('.service-invalidation-warning').evaluate(element=>{
        const style=getComputedStyle(element)
        const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
        const colors=[luminance(style.color),luminance(style.backgroundColor)].sort((a,b)=>b-a)
        return (colors[0]+.05)/(colors[1]+.05)
      })
      assert.ok(contrast>=4.5,`${theme} warning contrast ${contrast}`)
      await page.screenshot({path:`${output}${role}-${theme}-${width}.png`,fullPage:true})
      const previousPreviews=previewCount
      await confirm.click()
      if(role==='DISCIPLINE_ADMIN') {
        await dialog.getByRole('alert').filter({hasText:'Attendance changed'}).waitFor()
        assert.equal(previewCount,previousPreviews+1);await confirm.click()
      }
      await dialog.waitFor({state:'hidden'});assert.equal(posts,role==='DISCIPLINE_ADMIN'?2:1)
      if(width===1366&&theme==='light') {
        await page.goto(`${origin}${role==='DEPARTMENT_HEAD'?'department':'admin'}/community-service?assignment_id=19`)
        const date=page.getByLabel('Recorded Service Date');await date.waitFor();await date.selectOption(past)
        await page.getByRole('button',{name:'Invalidate Day',exact:true}).last().click()
        const pastDialog=page.getByRole('dialog',{name:'Invalidate Service Day'})
        await pastDialog.getByLabel('Reason',{exact:false}).fill('Student did not return')
        await pastDialog.getByRole('button',{name:'Invalidate Day',exact:true}).click()
        await pastDialog.waitFor({state:'hidden'})
        await page.getByText('Student did not return',{exact:true}).first().waitFor()
        if(role==='DEPARTMENT_HEAD') {
          const previousLoads=sessionLoads
          correction=4
          await page.evaluate(()=>window.dispatchEvent(new Event('online')))
          await page.waitForFunction(()=>[...document.querySelectorAll('.service-assignment-content dt')].find(element=>element.textContent==='Completed Time')?.nextElementSibling?.textContent==='4 hr')
          await page.waitForFunction(()=>[...document.querySelectorAll('.service-assignment-content dt')].find(element=>element.textContent==='Remaining Time')?.nextElementSibling?.textContent==='16 hr')
          assert.ok(sessionLoads>previousLoads)
        }
      }
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
    assert.deepEqual(errors,[])
    console.log(`PASS ${role} ${theme} ${width}`);await page.close()
  }
} finally {await browser?.close();await server.close()}
