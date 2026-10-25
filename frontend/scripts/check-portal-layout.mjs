// Uses synthetic records and the bundled Playwright runtime; no live account writes.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { auditThemeColors } from './lib/themeAudit.mjs'

const { chromium, expect } = createRequire(import.meta.url)('playwright/test')
const output = fileURLToPath(new URL('../artifacts/portal-layout/',import.meta.url))
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="app-shell department-portal" style="display:block"><main class="main-panel" style="margin:0;width:100%"><div class="page-content" id="root"></div></main></div><script type="module">
import React from 'react'
import {createRoot} from 'react-dom/client'
import Dashboard from '/src/components/DepartmentDashboard.jsx'
import Service from '/src/components/DepartmentCommunityService.jsx'
import Dtr from '/src/components/DepartmentDtr.jsx'
import Violations from '/src/components/StudentViolations.jsx'
import '/src/index.css'
import '/src/App.css'
import '/src/styles/portal-system.css'
import '/src/styles/portal-overrides.css'
import '/src/styles/department-portal.css'
const root=createRoot(document.getElementById('root'))
window.renderLayout=(view,props)=>{
 document.querySelector('.app-shell').className='app-shell '+(view==='violations'?'student-portal':'department-portal')
 root.render(React.createElement({dashboard:Dashboard,service:Service,dtr:Dtr,violations:Violations}[view],{key:view,onNavigate:path=>window.layoutTarget=path,onOpenScanner:()=>window.layoutTarget='/department/qr-scan',onFilter:value=>window.layoutFilters=value,...props}))
}
</script></body></html>`
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),cacheDir:output+'vite-cache',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'layout-fixture',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__layout.html'))return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,html))})}}]})
const now=Date.now()
const rows=Array.from({length:8},(_,i)=>({assignment_id:i+1,id:i+1,student_id:i+1,department_id:1,department_name:'Student Support',first_name:i===0?'Maria Alexandra':'Student',last_name:i===0?'Santos Dela Cruz':'Test '+i,student_number:'0200012345'+i,assignment_status:'IN_PROGRESS',status:'IN_PROGRESS',required_hours:4,remaining_hours:1.5,completed_hours:2.5,total_completed_sessions:3,total_credited_minutes:150,total_worked_minutes:180,latest_attendance_at:new Date(now-i*3600000).toISOString()}))
const sessions=rows.slice(0,6).map((row,i)=>({...row,session_id:i+1,status:'ACTIVE',session_type:'OPEN_TIME',time_in:new Date(now-(i+1)*3600000).toISOString(),credit_cutoff_at:new Date(now+(i===2?-1:1)*3600000).toISOString(),cutoff_reason:i===2?'DAY_ENDED':null,server_time:new Date(now).toISOString(),paused_at:i===1?new Date(now-600000).toISOString():null}))
const propsFor=(view,state='populated')=>{
 const data=state==='empty'?[]:state==='single'?rows.slice(0,1):rows
 const active=state==='empty'?[]:state==='single'?sessions.slice(0,1):sessions
 const common={loading:state==='loading',error:state==='error'?'Records unavailable.':undefined}
 if(view==='violations')return {...common,violations:data.map(row=>({id:row.id,status:'OPEN',severity:'MINOR',exact_offense:row.first_name+' uniform requirement',incident_date:'2026-10-25',required_service_hours:48,completed_service_hours:13.1,remaining_service_hours:34.9,history:[]}))}
 if(view==='service')return {...common,assignments:data,activeSessions:active,attendanceReady:state!=='error',attendanceLoading:state==='loading',attendanceError:common.error,now,token:'fixture-only'}
 return {...common,report:state==='loading'?null:{data,total_records:data.length,totals:{completed_sessions:data.length*3,worked_minutes:data.length*180,credited_minutes:data.length*150}},activeSessions:active,attendanceReady:state!=='error',attendanceError:common.error,departmentName:'Student Support Department'}
}
let browser
const errors=[]
try {
 await mkdir(output,{recursive:true});await server.listen()
 browser=await chromium.launch({channel:'msedge',headless:true})
 for(const width of [320,390,768,1440,1920])for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',bypassCSP:true})
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/**',route=>route.fulfill({json:{success:true,sessions:[],officers:[],assignments:[]}}))
  await page.goto(server.resolvedUrls.local[0]+'__layout.html')
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
  for(const view of ['dashboard','service','dtr','violations']) {
   await page.evaluate(({view,props})=>window.renderLayout(view,props),{view,props:propsFor(view)})
   await expect(page.locator('.department-page,.student-page')).toBeVisible()
   await page.evaluate(()=>document.fonts.ready)
   if(view==='dashboard') {
    await expect(page.locator('.department-current-attendance .department-activity-list > article')).toHaveCount(4)
    await expect(page.locator('.department-dashboard-side .department-near-list > article')).toHaveCount(6)
    const grid=await page.locator('.department-dashboard-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)
    assert.equal(grid,width>=1200?2:1,'Dashboard columns follow the available width')
    await page.getByRole('button',{name:'View Service Results',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.layoutTarget),'/department/community-service')
   }
   if(view==='service') {
    const cards=page.locator('.department-active-sessions > article')
    await expect(cards).toHaveCount(6)
    assert.equal(await page.locator('.department-active-sessions').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>=1280?2:1)
    for(const card of await cards.all()) {
     assert.ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth),'Live session contents fit their card')
     for(const action of await card.locator('.service-attendance-controls button').all()) {
      const box=await action.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Attendance actions remain touch accessible')
     }
    }
    for(const notice of await page.locator('.timer-limit-notice').all())await expect(notice).toContainText('Time Out Required')
   }
   if(view==='dtr') {
    const inputs=await page.locator('.department-dtr-filters input').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().top))
    if(width>=1200)assert.ok(Math.max(...inputs)-Math.min(...inputs)<1,'All four filter controls align despite unequal help text')
    else if(width>=390)assert.ok(Math.abs(inputs[0]-inputs[1])<1&&Math.abs(inputs[2]-inputs[3])<1,'Tablet filter pairs align')
    await page.getByLabel('Student ID',{exact:true}).fill('42')
    await page.getByRole('button',{name:'Apply Filters',exact:true}).click()
    assert.equal((await page.evaluate(()=>window.layoutFilters)).student_id,'42')
   }
   if(view==='violations') {
    await page.locator('.violation-summary').first().click()
    const progress=page.locator('.violation-details .service-progress')
    assert.equal(await progress.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)')
    const sizes=await progress.locator('.service-hours-grid > div').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().width))
    assert.ok(Math.max(...sizes)-Math.min(...sizes)<1,'Service totals receive equal columns')
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} ${theme} ${width}: no page overflow`)
   await expect.poll(async()=>(await page.evaluate(auditThemeColors)).findings).toEqual([])
   await page.screenshot({path:output+`${view}-${theme}-${width}.png`,fullPage:true})
   if([390,1440].includes(width))for(const state of ['empty','loading','error','single']) {
    await page.evaluate(({view,props})=>window.renderLayout(view,props),{view,props:propsFor(view,state)})
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} ${state}: no overflow`)
   }
   console.log(`PASS ${view} ${theme} ${width}`)
  }
  await page.close()
 }
 assert.deepEqual(errors,[])
 console.log('PASS dashboard organization, live card sizing/actions, filter alignment, service progress, themes, states, and responsive widths.')
} finally {await browser?.close();await server.close()}
