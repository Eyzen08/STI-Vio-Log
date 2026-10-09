import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { getNavItems, resolveRoute } from '../src/lib/routes.js'
import { mobileNavItemsFor, mobileNavLabel, sidebarNavigationFor } from '../src/lib/portalNavigation.js'
import { readFile } from 'node:fs/promises'

let server
const components = {}
before(async () => {
  server = await createServer({ configFile:false, plugins:[react()], server:{middlewareMode:true,hmr:false} })
  for (const name of ['DepartmentDashboard','DepartmentStudents','DepartmentCommunityService','DepartmentDtr']) components[name] = (await server.ssrLoadModule(`/src/components/${name}.jsx`)).default
})
after(async () => { await server?.close() })
const render = (name, props={}) => renderToStaticMarkup(createElement(components[name],props))
const row = {student_id:1,assignment_id:2,department_id:3,first_name:'Ana',last_name:'Reyes',student_number:'02000',department_name:'Library',assignment_status:'IN_PROGRESS',required_hours:8,remaining_hours:1.5,total_completed_sessions:2,total_worked_minutes:120,total_credited_minutes:90,attendance_outcome:'LEFT_EARLY',latest_attendance_at:'2026-10-08T01:00:00Z'}
const report = {data:[row],total_records:1,totals:{completed_sessions:2,worked_minutes:120,credited_minutes:90}}

test('removed department pages redirect without navigation entries or cross-role access', () => {
  for (const path of ['/department/reports','/department/non-compliance']) {
    assert.equal(resolveRoute(path,'DEPARTMENT_HEAD').redirectTo,'/department/dashboard')
    assert.equal(resolveRoute(path,'STUDENT').status,'unauthorized')
    assert.equal(getNavItems('DEPARTMENT_HEAD').some(item=>item.path===path),false)
    assert.doesNotMatch(JSON.stringify(sidebarNavigationFor('DEPARTMENT_HEAD')),new RegExp(path))
  }
  assert.deepEqual(mobileNavItemsFor(getNavItems('DEPARTMENT_HEAD'),'DEPARTMENT_HEAD').map(mobileNavLabel),['Home','Scan','Service','Attendance'])
  assert.equal(resolveRoute('/admin/reports','DISCIPLINE_ADMIN').status,'allowed')
})

test('department dashboard uses real active attendance and aggregate report facts', () => {
  const html=render('DepartmentDashboard',{report,activeSessions:[{student_id:1,status:'ACTIVE',time_out:null}],attendanceReady:true})
  assert.match(html,/Students timed in<\/span><strong>1/)
  assert.match(html,/Recent attendance/)
  assert.match(html,/Left Early/)
  assert.doesNotMatch(html,/Missing time out|Today's attendance|Generate Report|Time in<\/td>/)
})

test('department service renders shared active attendance and frozen timer once', () => {
  const start=Date.parse('2026-10-08T01:00:00Z')
  const html=render('DepartmentCommunityService',{assignments:[],activeSessions:[{session_id:3,assignment_id:2,first_name:'Ana',last_name:'Reyes',status:'ACTIVE',time_in:new Date(start).toISOString(),time_out:null,session_type:'OPEN_TIME',credit_cutoff_at:new Date(start+6*3600000).toISOString(),completed_today_minutes:120,remaining_hours:20}],attendanceReady:true,now:start+7*3600000})
  assert.match(html,/Ana Reyes/)
  assert.match(html,/Time elapsed/)
  assert.match(html,/06:00:00/)
  assert.match(html,/Daily Community Service Limit Reached/)
  assert.match(html,/Time Out/)
  assert.equal((html.match(/<time/g)||[]).length,1)
})

test('department attendance preserves aggregate facts and collapses corrections', () => {
  const html=render('DepartmentDtr',{report})
  assert.match(html,/Service dates/)
  assert.doesNotMatch(html,/\b(?:Manila|Asia)\b/i)
  assert.match(html,/<details[^>]*><summary>Hour corrections<\/summary>/)
  for (const fact of ['02000','Left Early','1h 30m','2h']) assert.ok(html.includes(fact))
  assert.doesNotMatch(html,/UTC reporting/)
})

test('department pages distinguish loading, failures and empty records', () => {
  for (const name of Object.keys(components)) {
    assert.match(render(name,{loading:true,assignments:[]}),/aria-live="polite"/)
    assert.match(render(name,{error:'Records unavailable',assignments:[]}),/Records unavailable/)
  }
  assert.match(render('DepartmentStudents',{}),/No students served yet/)
  assert.match(render('DepartmentCommunityService',{assignments:[],attendanceReady:true}),/No students currently timed in/)
  assert.match(render('DepartmentCommunityService',{assignments:[],attendanceError:'Attendance unavailable',attendanceReady:false}),/Attendance unavailable/)
})

test('department shared-page styles stay scoped and load after base portal themes', async () => {
  const css=await readFile(new URL('../src/styles/department-portal.css',import.meta.url),'utf8')
  const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8')
  assert.ok(main.indexOf("await import('./styles/department-portal.css')") > main.indexOf("await import('./styles/admin-dashboard.css')"))
  for (const rule of css.split('}')) {
    if (/\.(?:account-password-form|password-visibility|avatar-preset-grid|staff-profile-card|notification-filters|qr-stage-grid)/.test(rule)) assert.ok(rule.includes('.department-portal'),rule)
  }
})
