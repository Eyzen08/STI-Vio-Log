import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDepartmentOfficerPayload, filterDepartmentOfficers, officerFormValid } from '../src/lib/departmentOfficerAdmin.js'
import { readFile } from 'node:fs/promises'

test('editable department type supplies the API name and new departments are active',()=>{assert.deepEqual(buildDepartmentOfficerPayload({departmentType:'  Student  Affairs ',departmentStatus:'inactive',username:'  Office.Head ',role:'department_head',firstName:' Ana ',lastName:' Cruz ',email:' ANA@EXAMPLE.COM ',description:'  Student  services ',employeeNumber:'  EMP-1 '}),{department_name:'Student Affairs',description:'Student services',department_status:'active',username:'office.head',role:'DEPARTMENT_HEAD',first_name:'Ana',last_name:'Cruz',employee_number:'EMP-1',email:'ana@example.com'})})
test('single form requires all officer and department details for both supported roles',()=>{
  const form={departmentType:'Library',firstName:'Ana',lastName:'Cruz',username:'officer',role:'DISCIPLINE_OFFICE'}
  for(const role of ['DISCIPLINE_OFFICE','DEPARTMENT_HEAD'])assert.equal(officerFormValid({...form,role}),true)
  for(const field of ['departmentType','firstName','lastName','username'])assert.equal(officerFormValid({...form,[field]:'  '}),false,`${field} is required`)
  assert.equal(officerFormValid({...form,role:'ADMIN'}),false)
  assert.equal(buildDepartmentOfficerPayload(form).email,undefined)
  assert.equal(buildDepartmentOfficerPayload(form).employee_number,undefined)
  assert.equal(buildDepartmentOfficerPayload(form).description,undefined)
})
test('directory filters linked officers by department, role, and status',()=>{const accounts=[{id:1,first_name:'Ana',last_name:'Cruz',username:'ana',role:'DEPARTMENT_HEAD',is_active:true,department_id:4},{id:2,first_name:'Ben',last_name:'Lim',username:'ben',role:'DISCIPLINE_OFFICE',is_active:false}];const departments=[{id:4,department_name:'Library'}];assert.deepEqual(filterDepartmentOfficers(accounts,departments,{search:'library',role:'DEPARTMENT_HEAD',status:'ACTIVE'}).map(x=>x.id),[1])})

test('department tabs use one compact surface with a sliding active pill',async()=>{const css=await readFile(new URL('../src/styles/portal-system.css',import.meta.url),'utf8');assert.match(css,/\.department-officer-tabs\s*\{[^}]*gap:\s*0;[^}]*border:\s*1px solid #bed2e6;[^}]*border-radius:\s*12px;/s);assert.match(css,/\.department-officer-tabs::before\s*\{[^}]*width:\s*var\(--tab-indicator-width\);[^}]*background:\s*#0871ce;[^}]*transform:\s*translateX\(var\(--tab-indicator-x\)\);[^}]*transition:\s*transform 200ms ease, width 200ms ease;/s);assert.match(css,/button\[aria-selected='true'\]\s*\{[^}]*background:\s*transparent !important;[^}]*color:\s*#ffffff !important;/s);assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.department-officer-tabs::before,[\s\S]*transition:\s*none;/s)})

test('department tabs control inline panels without reloading directory data',async()=>{const component=await readFile(new URL('../src/components/AdminDepartmentOfficers.jsx',import.meta.url),'utf8');assert.match(component,/role="tablist"[\s\S]*aria-controls="department-directory-panel"[\s\S]*aria-controls="department-create-panel"/);assert.match(component,/role="tabpanel" aria-labelledby="department-create-tab"/);assert.match(component,/role="tabpanel" aria-labelledby="department-directory-tab"/);assert.match(component,/\['ArrowLeft','ArrowRight','Home','End'\]/);assert.doesNotMatch(component,/onClick=\{\(\)=>\{setTab\('directory'\);load\(\)\}\}/);assert.doesNotMatch(component,/tab==='create'&&<Modal title="Add Department \/ Officer"/)})

test('inline dark form keeps headings and labels readable',async()=>{const css=await readFile(new URL('../src/styles/portal-system.css',import.meta.url),'utf8');assert.match(css,/\.department-officer-create\.department-tab-panel :is\(\.section-heading h3,\.student-form label\)[^}]*color: var\(--text-primary\) !important;/s)})

test('department and officer actions use clear Title Case labels',async()=>{const component=await readFile(new URL('../src/components/AdminDepartmentOfficers.jsx',import.meta.url),'utf8');assert.match(component,/>Officer Directory</);assert.match(component,/>Create Officer Account</);assert.match(component,/'Create Officer Account'/);assert.match(component,/>Edit Officer</);assert.match(component,/>Reset Password</)})

test('officer and certificate action groups keep a consistent gap',async()=>{const css=await readFile(new URL('../src/styles/portal-system.css',import.meta.url),'utf8');assert.match(css,/\.main-panel \.inline-actions,\s*\.main-panel \.officer-directory \.registration-review-actions\s*\{[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*10px;/s);assert.match(css,/@media \(max-width: 600px\)[\s\S]*\.main-panel \.inline-actions > button,[\s\S]*min-height:\s*44px;/s)})
