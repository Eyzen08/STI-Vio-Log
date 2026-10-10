const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const reports = require('../src/controllers/reportController');
const routes = require('../src/routes/reportRoutes');

const lifecycleStatuses = () => require('node:fs').readFileSync(require('node:path').join(__dirname,'../../database/migrations/002_violation_lifecycle.sql'),'utf8').match(/CREATE TYPE violation_lifecycle_status AS ENUM \(([\s\S]*?)\)/)[1].match(/'[^']+'/g).map(value=>value.slice(1,-1));

test('violation report filters accept the migration lifecycle enum, not assignment statuses', async () => {
  const pool=require('../src/config/database'),original=pool.query,statuses=lifecycleStatuses();
  pool.query=async(sql,params)=>{assert.ok(statuses.includes(params[0]));return {rows:[]}};
  try {
    for(const status of statuses)await reports.loadViolationReport({query:{status},user:{role:'DISCIPLINE_ADMIN'}});
    for(const status of ['IN_PROGRESS','COMPLETED','CLEARED','ADMIN_CLOSED','INVALID_CANCELLED'])await assert.rejects(reports.loadViolationReport({query:{status},user:{role:'DISCIPLINE_ADMIN'}}),error=>error.statusCode===400);
  } finally {pool.query=original}
});

test('good-standing previews and workbooks use valid violation enum literals', async () => {
  const pool=require('../src/config/database'),original=pool.query,statuses=lifecycleStatuses();
  pool.query=async sql=>{for(const match of sql.matchAll(/v\.status\s*(?:<>|=)\s*'([^']+)'/g))assert.ok(statuses.includes(match[1]),`Invalid violation enum: ${match[1]}`);return {rows:[]}};
  try {
    await require('../src/controllers/extendedReportController').loadGoodStandingReport({query:{},user:{role:'DISCIPLINE_ADMIN'}});
    const res={statusCode:200,status(code){this.statusCode=code;return this},setHeader(){},send(body){this.body=body;return this},json(body){this.body=body;return this}};
    await require('../src/controllers/reportExportController').exportReport('good-standing')({query:{},user:{role:'DISCIPLINE_ADMIN'}},res);
    assert.equal(res.statusCode,200);assert.ok(Buffer.isBuffer(res.body));
  } finally {pool.query=original}
});

test('all seven report types expose Excel downloads alongside their existing JSON routes', () => {
  const paths = routes.stack.filter(layer => layer.route).map(layer => layer.route.path);
  for (const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    assert.ok(paths.includes(`/${type}.xlsx`), type); assert.ok(paths.includes(`/${type}`));
  }
});

test('Excel year cells match report preview labels for college and senior high', async () => {
  for (const [academic_level, year_level, expected] of [['COLLEGE', 2, '2nd Year'], ['SENIOR_HIGH_SCHOOL', 11, 'Grade 11']]) {
    const workbook = require('../src/services/reportExport').createReportWorkbook('good-standing', {
      data: [{first_name:'Alex', last_name:'Santos', student_number:'02000123456', academic_level, strand:'STEM', program:'BSIT', year_level}]
    });
    const sheet = await new ExcelJS.Workbook().xlsx.load(await workbook.xlsx.writeBuffer());
    const report = sheet.worksheets[0];
    const column = report.getRow(6).values.indexOf('Year / Grade level');
    assert.equal(report.getRow(7).getCell(column).value, expected);
  }
});

test('report workbooks preserve all rows, readable metadata and literal text without internal fields', async () => {
  assert.equal(typeof reports.createReportWorkbook, 'function');
  const row = {first_name:'=Maria',last_name:'Santos',student_number:'000123',avatar:{data:'hidden-avatar'},assignment_id:42,department_name:'Library',violation_name:'Minor Offense',description:'Handbook offense: No ID\nIncident details: Missing ID\nSecond line',incident_date:'2026-10-08',status:'OPEN',remaining_hours:0,has_active_violation:false,has_pending_service:true,total_credited_minutes:0,total_worked_minutes:90,manual_adjustment_hours:-0.5,program:'BSIT',academic_level:'COLLEGE',year_level:1};
  for (const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    const payload={data:Array.from({length:61},()=>row),hourCorrections:[{...row,previous_completed_hours:2,new_completed_hours:0,reason:'Corrected duplicate credit',created_at:'2026-10-07T16:00:00Z'}]};
    const workbook=await new ExcelJS.Workbook().xlsx.load(await reports.createReportWorkbook(type,payload,{student_id:'2'},new Date('2026-10-07T16:30:00Z')).xlsx.writeBuffer());
    const sheet=workbook.worksheets[0];
    assert.equal(sheet.getCell('B4').value,61); assert.equal(sheet.rowCount,67);
    assert.match(sheet.getCell('A2').value,/Oct 8, 2026.*12:30 AM/);
    assert.doesNotMatch(JSON.stringify(workbook.worksheets.map(tab=>tab.getSheetValues())),/\b(?:Manila|Asia)\b/i);
    assert.match(sheet.getCell('A3').value,/Student.*2/);
    assert.equal(sheet.getCell('A7').value,'=Maria Santos'); assert.equal(sheet.getCell('A7').type,ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('B7').value,'000123'); assert.equal(sheet.getCell('B7').numFmt,'@');
    assert.doesNotMatch(JSON.stringify(sheet.getSheetValues()),/hidden-avatar|Assignment Id/);
    assert.equal(sheet.views[0].ySplit,6); assert.ok(sheet.autoFilter); assert.equal(sheet.getCell('A7').alignment.wrapText,true);
    for (const tab of workbook.worksheets) {
      assert.equal(tab.views[0].showGridLines, false);
      assert.equal(tab.views[0].xSplit, 2);
      assert.equal(tab.getCell('A6').font.name, 'Arial');
      assert.equal(tab.getCell('A6').fill.fgColor.argb, 'FF123553');
      assert.equal(tab.pageSetup.fitToPage, false);
      assert.equal(tab.pageSetup.printTitlesRow, '6:6');
      assert.equal(tab.pageSetup.printTitlesColumn, 'A:B');
      assert.equal(tab.pageSetup.printArea, `A1:${tab.getColumn(tab.columnCount).letter}${tab.rowCount}`);
      assert.ok(tab.columns.every(column => column.width <= 48));
    }
    assert.equal(sheet.getCell('B4').alignment.horizontal, 'right');
    const values=sheet.getRow(7).values.slice(1);
    if(type==='violations'){assert.ok(values.includes('No ID'));assert.ok(values.includes('Missing ID\nSecond line'));}
    if(type==='clearance'){assert.ok(values.includes('No'));assert.ok(values.includes('Yes'));}
    if(type==='dtr'){
      assert.ok(values.includes('0 min'));assert.ok(values.includes('1 hr 30 min'));assert.ok(values.includes('−30 min'));
      const corrections=workbook.getWorksheet('Hour Corrections'); assert.ok(corrections); assert.match(JSON.stringify(corrections.getSheetValues()),/2 hr.*0 min.*Corrected duplicate credit/);
    }
  }
});

test('JSON and Excel use the same filtered queries, calendar validation and department scope', async () => {
  const pool=require('../src/config/database'),original=pool.query,calls=[];
  const {loadParentContactReport}=require('../src/controllers/extendedReportController');
  const {loadDTRReport}=require('../src/controllers/communityServiceSessionReportController');
  const {exportReport}=require('../src/controllers/reportExportController');
  pool.query=async(sql,params)=>{calls.push({sql,params});return {rows:[]};};
  const response=()=>({statusCode:200,headers:{},status(value){this.statusCode=value;return this},setHeader(key,value){this.headers[key]=value},send(body){this.body=body;return this},json(body){this.body=body;return this}});
  const query={status:'OPEN',student_id:'12',from_date:'2026-10-08',to_date:'2026-10-08',search:'Maria',sort_by:'date_desc'},user={role:'DISCIPLINE_ADMIN'};
  try {
    await reports.loadViolationReport({query,user});const preview=calls.at(-1);
    const res=response();await reports.exportViolationReportXlsx({query,user},res);
    assert.equal(res.statusCode,200);assert.deepEqual(calls.at(-1),preview);assert.doesNotMatch(preview.sql,/LIMIT|OFFSET/);
    assert.deepEqual(preview.params,['OPEN','12','2026-10-08','2026-10-08','%Maria%']);
    await loadParentContactReport({query:{from_date:'2026-10-08',to_date:'2026-10-08'},user});
    assert.match(calls.at(-1).sql,/AT TIME ZONE 'Asia\/Manila'/);assert.match(calls.at(-1).sql,/\+ 1/);
    const before=calls.length;
    for(const badQuery of [{from_date:'2026-02-30'},{from_date:'2026-10-09',to_date:'2026-10-08'}]) {
      await assert.rejects(reports.loadViolationReport({query:badQuery,user}),error=>error.statusCode===400);
      await assert.rejects(loadParentContactReport({query:badQuery,user}),error=>error.statusCode===400);
    }
    await assert.rejects(loadDTRReport({query:{department_id:'4'},user:{role:'DEPARTMENT_HEAD',department_id:3}}),error=>error.statusCode===403);
    assert.equal(calls.length,before);
    await reports.loadNonComplianceReport({query:{sort_by:'hours'},user:{role:'DEPARTMENT_HEAD',department_id:3}});
    assert.deepEqual(calls.at(-1).params,[3]);assert.match(calls.at(-1).sql,/scoped_session.department_id = \$1/);
    pool.query=async()=>{throw new Error('private database detail')};
    const failed=response();await exportReport('clearance')({query:{},user},failed);assert.equal(failed.statusCode,500);assert.doesNotMatch(JSON.stringify(failed.body),/private database detail/);
  } finally {pool.query=original;}
});

test('all Excel downloads enforce viewing and export permissions and record export audit events',async()=>{
  const express=require('express'),pool=require('../src/config/database'),sessions=require('../src/services/browserSessionService');
  const original=pool.query,events=[],queries=[];
  pool.query=async(sql,params)=>{
    if(sql.includes('FROM browser_sessions'))return {rows:[{id:1,username:'admin',role:params[0]===sessions.hash('office')?'DISCIPLINE_OFFICE':params[0]===sessions.hash('head')?'DEPARTMENT_HEAD':params[0]===sessions.hash('student')?'STUDENT':'DISCIPLINE_ADMIN',email_verified:true,browser_session_id:1}]};
    if(sql.includes('INSERT INTO administrative_security_events')){events.push(params);return {rows:[]};}
    queries.push({sql,params});return {rows:[]};
  };
  const {authenticateToken}=require('../src/middleware/authMiddleware');
  const scope=(req,_res,next)=>{
    if(req.headers.cookie==='sti_session=view-only')req.user.permissions=['REPORT_VIEW'];
    if(req.headers.cookie==='sti_session=export-only')req.user.permissions=['DATA_EXPORT'];
    if(req.headers.cookie==='sti_session=no-guardian')req.user.permissions=['REPORT_VIEW','DATA_EXPORT'];next();
  };
  const app=express();
  for(const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    const route=routes.stack.find(layer=>layer.route?.path===`/${type}.xlsx`).route;
    app.get(`/api/reports/${type}.xlsx`,authenticateToken,scope,...route.stack.slice(1).map(layer=>layer.handle));
  }
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/api/reports`;
  const request=(path,token)=>fetch(`${base}/${path}`,{headers:token?{Cookie:`sti_session=${token}`}:{}});
  try {
    for(const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
      for(const token of [undefined,'head','student','view-only','export-only']) {
        const res=await request(`${type}.xlsx`,token);await res.arrayBuffer();assert.equal(res.status,token?403:401,`${type}:${token}`);
      }
      for(const token of ['admin','office']) {
        const res=await request(`${type}.xlsx`,token);assert.equal(res.status,200,type);assert.match(res.headers.get('content-type'),/spreadsheetml/);assert.equal(res.headers.get('cache-control'),'no-store');assert.match(res.headers.get('content-disposition'),/STI_Vio-Log_.*_\d{4}-\d{2}-\d{2}.xlsx/);
        const workbook=await new ExcelJS.Workbook().xlsx.load(Buffer.from(await res.arrayBuffer()));assert.equal(workbook.worksheets[0].getCell('B4').value,0);
      }
    }
    const reportQueries=()=>queries.filter(({sql})=>/FROM (violations|parent_contact_logs|student_clearance|students|community_service_assignments|community_service_sessions)\b/.test(sql)).length;
    const before=reportQueries();
    const noGuardian=await request('parent-contacts.xlsx','no-guardian');await noGuardian.arrayBuffer();assert.equal(noGuardian.status,403);assert.equal(reportQueries(),before);
    const invalid=await request('violations.xlsx?from_date=2026-02-30','admin');await invalid.arrayBuffer();assert.equal(invalid.status,400);
    const exports=events.filter(event=>event[4]==='SENSITIVE_DATA_EXPORT');assert.equal(exports.filter(event=>event[13]==='SUCCESS').length,14);assert.equal(exports.filter(event=>event[13]==='FAILED').length,1);
    assert.doesNotMatch(JSON.stringify(exports),/2026-02-30|student_number|guardian_name/);
  } finally {await new Promise(resolve=>server.close(resolve));pool.query=original;}
});
