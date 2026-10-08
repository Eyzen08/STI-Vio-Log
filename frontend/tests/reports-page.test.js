import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let server, Reports, ReportTable, ReportFilters, downloadReportExcel
before(async () => {
  server=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true,hmr:false}})
  const module=await server.ssrLoadModule('/src/components/AdminReports.jsx'); Reports=module.default;ReportTable=module.ReportTable;ReportFilters=module.ReportFilters
  downloadReportExcel=(await server.ssrLoadModule('/src/lib/adminReports.js')).downloadReportExcel
})
after(async () => { await server?.close() })

test('Reports starts with an unavailable export and presents relevant controls for all seven types', () => {
  assert.equal(typeof Reports,'function')
  const initial=renderToStaticMarkup(createElement(Reports,{token:'test',students:[]}))
  assert.match(initial,/<button[^>]*disabled=""[^>]*>[\s\S]*?Export Excel/)
  assert.doesNotMatch(initial,/>Student ID</)
  for(const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    const html=renderToStaticMarkup(createElement(ReportFilters,{type,filters:{},students:[],studentSearch:'',onFilter:()=>{},onStudent:()=>{},onType:()=>{}}))
    assert.match(html,/Report type/)
    assert.equal(html.includes('From date'),['violations','dtr','parent-contacts'].includes(type))
    assert.equal(html.includes('Status'),['violations','community-service','clearance'].includes(type))
    assert.equal(html.includes('<label>Student<input'),type!=='non-compliance')
  }
})

test('report tables group students and violations, disclose long text and hide implementation fields', () => {
  assert.equal(typeof ReportTable,'function')
  const source={first_name:'Maria',last_name:'Santos',student_number:'000123',avatar:'hidden-avatar',assignment_id:42,description:`Handbook offense: No ID\nIncident details: ${'Long incident '.repeat(30)}`,status:'OPEN',has_active_violation:false,total_credited_minutes:0}
  for(const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    const html=renderToStaticMarkup(createElement(ReportTable,{type,rows:[source]}))
    assert.match(html,/Maria Santos/);assert.match(html,/000123/);assert.doesNotMatch(html,/hidden-avatar|Assignment Id|First Name|Last Name/)
    if(type==='violations'){assert.match(html,/No ID/);assert.match(html,/<details/);assert.match(html,/View details/);assert.doesNotMatch(html,/Handbook offense:/)}
    if(type==='clearance')assert.match(html,/>No</)
    if(type==='dtr')assert.match(html,/0 min/)
  }
})

test('Excel downloads carry generated filters, preserve server filenames, errors, and URL cleanup',async()=>{
  assert.equal(typeof downloadReportExcel,'function')
  const originals={fetch:globalThis.fetch,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let url,clicks=0,revokes=0
  const anchor={click(){clicks++}};globalThis.document={createElement:()=>anchor};URL.createObjectURL=()=> 'blob:report';URL.revokeObjectURL=()=>{revokes++}
  globalThis.fetch=async value=>{url=value;return new Response('xlsx',{headers:{'Content-Disposition':'attachment; filename="STI_Vio-Log_Violations_Report_2026-10-08.xlsx"'}})}
  try {
    await downloadReportExcel('violations',{status:'OPEN',search:'Maria',sort_by:'date_desc'},'token')
    assert.match(url,/\/violations.xlsx\?status=OPEN&search=Maria&sort_by=date_desc$/);assert.equal(anchor.download,'STI_Vio-Log_Violations_Report_2026-10-08.xlsx');assert.equal(clicks,1);assert.equal(revokes,1)
    globalThis.fetch=async()=>new Response('xlsx');await downloadReportExcel('dtr',{},'token');assert.match(anchor.download,/^STI_Vio-Log_DTR_Attendance_Report_\d{4}-\d{2}-\d{2}\.xlsx$/);assert.equal(revokes,2)
    anchor.click=()=>{throw new Error('Blocked download')};await assert.rejects(downloadReportExcel('dtr',{},'token'),/Blocked/);assert.equal(revokes,3)
    globalThis.fetch=async()=>new Response(JSON.stringify({message:'Permission denied'}),{status:403});await assert.rejects(downloadReportExcel('clearance',{},'token'),/Permission denied/)
    globalThis.fetch=async()=>{throw new Error('Network unavailable')};await assert.rejects(downloadReportExcel('clearance',{},'token'),/Network unavailable/)
  } finally {globalThis.fetch=originals.fetch;globalThis.document=originals.document;URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke}
})
