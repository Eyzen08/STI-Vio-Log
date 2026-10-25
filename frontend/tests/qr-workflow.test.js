import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { apiRequest } from '../src/lib/api.js'

// Exercise the actual request handler with deferred HTTP responses, without a camera.
const source=(await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')).replace(/\r\n/g,'\n')
const EMPTY_QR_SERVICE_DRAFT=runInNewContext(source.match(/const EMPTY_QR_SERVICE_DRAFT = \{[\s\S]*?\n}/)[0]+'; EMPTY_QR_SERVICE_DRAFT')
const handler=source.slice(source.indexOf('  const handleQrAction = async'),source.indexOf('  qrActionRef.current=handleQrAction'))
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
const setup=()=>{
  const requests=[]
  const context={EMPTY_QR_SERVICE_DRAFT,qrForm:{qr_code:'old'},qrFormRef:{current:{qr_code:'old',assignment_id:21,supervising_officer_id:9,notes:'Old student note'}},qrActionBusyRef:{current:null},qrInputVersionRef:{current:0},attendanceAccountRef:{current:1},verifiedQrRef:{current:'old'},user:{id:1},token:'test',API_URL:'',sessionStorage:{setItem(){},removeItem(){}},isAdmin:false,refreshes:0,pendingRefreshes:0,historyRequests:0,setDashboardRefreshKey(){context.refreshes++},refreshPendingActions(){context.pendingRefreshes++},setQrInputSource(){},
    setQrResult(value){context.result=typeof value==='function'?value(context.result):value},setVerifiedQr(value){context.verified=value},setQrError(value){context.error=value},setQrSubmitting(){},setQrHistory(value){context.history=value},setQrHistoryError(value){context.historyError=value},setQrForm(update){context.qrFormRef.current=typeof update==='function'?update(context.qrFormRef.current):update},
    apiRequest(path,options){const original=globalThis.fetch;globalThis.fetch=context.fetch;try{return apiRequest(path,options)}finally{globalThis.fetch=original}},
    fetch(url,options){url=new URL(url,'http://localhost').pathname;if(url.endsWith('/sessions')){context.historyRequests++;return context.historyResponse||Promise.resolve(ok('old',{sessions:[]}))}const pending=deferred();requests.push({url,options,pending});return pending.promise}}
  const action=runInNewContext(handler+'; handleQrAction',context)
  return {action,context,requests}
}
const ok=(code,fields={})=>new Response(JSON.stringify({success:true,student:{qr_code:code},...fields}),{headers:{'content-type':'application/json'}})

test('a successful Time In stays successful when history returns HTML and is never retried',async()=>{
  const {action,context,requests}=setup()
  context.historyResponse=Promise.resolve(new Response('<!DOCTYPE html>',{status:502,headers:{'content-type':'text/html'}}))
  const saving=action('time-in','old')
  requests[0].pending.resolve(ok('old',{assignment:{id:21},session:{id:7,status:'ACTIVE'}}))
  assert.equal(await saving,true)
  assert.equal(context.result.session.id,7)
  assert.equal(context.error,'')
  assert.equal(context.historyError,'Attendance history is temporarily unavailable. Please try again.')
  assert.equal(context.refreshes,1)
  assert.equal(context.pendingRefreshes,1)
  assert.equal(requests.length,1)
  assert.equal(context.historyRequests,1)
})

test('HTML verification responses produce a readable failure without verifying the student',async()=>{
  const {action,context,requests}=setup()
  const scanning=action('scan','new-student')
  requests[0].pending.resolve(new Response('<!DOCTYPE html>',{headers:{'content-type':'text/html'}}))
  assert.equal(await scanning,false)
  assert.equal(context.verified,undefined)
  assert.equal(context.error,'The service is temporarily unavailable. Please try again.')
})

test('history failures and late history results cannot overwrite a different student',async()=>{
  for(const fail of [false,true]){
    const {action,context,requests}=setup()
    const pending=deferred()
    context.historyResponse=pending.promise
    const scanning=action('scan','old')
    requests[0].pending.resolve(ok('old',{assignment:{id:21}}))
    await new Promise(resolve=>setImmediate(resolve))
    context.qrInputVersionRef.current++
    context.history=[{id:99}]
    context.historyError='New student history status'
    pending.resolve(fail?new Response('<html>',{headers:{'content-type':'text/html'}}):ok('old',{sessions:[{id:7}]}))
    await scanning
    assert.deepEqual(context.history,[{id:99}])
    assert.equal(context.historyError,'New student history status')
  }
})

test('successful history refresh clears its earlier error',async()=>{
  const {action,context,requests}=setup()
  context.historyError='Earlier failure'
  const scanning=action('scan','old',{quiet:true})
  requests[0].pending.resolve(ok('old',{assignment:{id:21}}))
  assert.equal(await scanning,true)
  assert.equal(context.historyError,'')
})

test('verified time in needs an officer and sends no planned duration',async()=>{
  const {action,context,requests}=setup()
  delete context.qrFormRef.current.session_type
  delete context.qrFormRef.current.selected_duration_minutes
  const saving=action('time-in','old')
  assert.equal(requests.length,1)
  const body=JSON.parse(requests[0].options.body)
  assert.equal(body.supervising_officer_id,9)
  assert.equal('session_type' in body,false)
  assert.equal('selected_duration_minutes' in body,false)
  requests[0].pending.resolve(ok('old'))
  assert.equal(await saving,true)
})

test('a decoded scan waits for polling and ignores the older student response',async()=>{
  const {action,context,requests}=setup()
  const polling=action('scan','old',{quiet:true})
  context.qrInputVersionRef.current++
  context.qrFormRef.current.qr_code='camera'
  context.verifiedQrRef.current=''
  const scanning=action('scan','camera')
  assert.equal(requests.length,1)
  requests[0].pending.resolve(ok('old'))
  assert.equal(await polling,false)
  assert.equal(requests.length,2)
  requests[1].pending.resolve(ok('camera'))
  assert.equal(await scanning,true)
  assert.equal(context.verified,'camera')
  assert.equal(context.result.student.qr_code,'camera')
  assert.equal(context.qrActionBusyRef.current,null)
})

test('editing manual input discards pending verification and its errors',async()=>{
  const {action,context,requests}=setup()
  const checking=action('scan','old')
  context.qrInputVersionRef.current++
  context.qrFormRef.current.qr_code='manual'
  requests[0].pending.resolve(new Response(JSON.stringify({success:false,message:'Old failure'}),{status:400,headers:{'content-type':'application/json'}}))
  assert.equal(await checking,false)
  assert.equal(context.verified,undefined)
  assert.equal(context.error,'')
})

test('background refresh skips an in-flight verification instead of duplicating it',async()=>{
  const {action,requests}=setup()
  const checking=action('scan','old')
  await action('scan','old',{quiet:true})
  await action('time-in','old')
  assert.equal(requests.length,1)
  requests[0].pending.resolve(ok('old'))
  assert.equal(await checking,true)
})

test('polling verifies saved sessions but leaves unverified manual input alone',()=>{
  const block=source.slice(source.indexOf('  useEffect(()=>{\n    if(!portalReady||activeView'),source.indexOf("  },[portalReady,activeView,token,user?.id,realtimeSocket])"))+'  })'
  const calls=[]
  let refresh
  const context={portalReady:true,activeView:'QR Scan',token:'test',user:{id:1},qrFormRef:{current:{qr_code:'typed'}},attendanceAccountRef:{current:1},verifiedQrRef:{current:''},qrActionRef:{current(...args){calls.push(args)}},sessionStorage:{getItem(){return 'previous'}},document:{visibilityState:'visible',addEventListener(){}},window:{setInterval(callback){refresh=callback},addEventListener(){}},realtimeSocket:null,useEffect(effect){effect()}}
  runInNewContext(block,context)
  refresh()
  assert.equal(calls.length,0)
  context.verifiedQrRef.current='verified'
  refresh()
  assert.equal(calls.length,1)
  assert.equal(calls[0][1],'verified')
})

test('camera decode invokes current automatic verification without a Verify click',async()=>{
  const start=source.indexOf('        (decodedText) => {')
  const end=source.indexOf('\n        },',start)
  const callback=source.slice(start,end)+'\n        }'
  const calls=[]
  const context={EMPTY_QR_SERVICE_DRAFT,qrDecodeBusyRef:{current:false},qrInputVersionRef:{current:0},qrFormRef:{current:{assignment_id:21,supervising_officer_id:9,notes:'Previous note'}},attendanceAccountRef:{current:1},verifiedQrRef:{current:'previous'},scanner:{},setQrInputSource(value){context.inputSource=value},setQrForm(){},setVerifiedQr(){},setQrResult(){},setQrHistory(){},setQrHistoryError(){},setQrError(){},stopQrScanner:async()=>{},qrActionRef:{current:async(...args)=>{calls.push(args)}}}
  runInNewContext('('+callback+')',context)(' camera-code ')
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,[['scan','camera-code']])
  assert.equal(context.inputSource,'camera')
  assert.equal(context.qrFormRef.current.qr_code,'camera-code')
  assert.equal(context.qrFormRef.current.assignment_id,'')
  assert.equal(context.qrFormRef.current.supervising_officer_id,'')
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(context.verifiedQrRef.current,'')
  assert.equal(context.qrDecodeBusyRef.current,false)
})

test('manual editing while the camera stops cancels its delayed verification',async()=>{
  const start=source.indexOf('        (decodedText) => {')
  const end=source.indexOf('\n        },',start)
  const stop=deferred()
  const calls=[]
  const context={EMPTY_QR_SERVICE_DRAFT,qrDecodeBusyRef:{current:false},qrInputVersionRef:{current:0},qrFormRef:{current:{}},attendanceAccountRef:{current:1},verifiedQrRef:{current:''},scanner:{},setQrInputSource(){},setQrForm(){},setVerifiedQr(){},setQrResult(){},setQrHistory(){},setQrHistoryError(){},setQrError(){},stopQrScanner:()=>stop.promise,qrActionRef:{current:async(...args)=>{calls.push(args)}}}
  runInNewContext('('+source.slice(start,end)+'\n        })',context)('camera-code')
  context.qrInputVersionRef.current++
  context.qrFormRef.current.qr_code='manual-code'
  stop.resolve()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(calls.length,0)
  assert.equal(context.qrFormRef.current.qr_code,'manual-code')
  assert.equal(context.qrDecodeBusyRef.current,false)
})

test('fresh verification clears notes and never submits Time In',async()=>{
  const {action,context,requests}=setup()
  const checking=action('scan','new-student')
  requests[0].pending.resolve(ok('new-student',{assignment:{id:22},available_officers:[{officer_user_id:10}]}))
  await checking
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(context.qrFormRef.current.assignment_id,22)
  assert.equal(context.qrFormRef.current.supervising_officer_id,10)
  assert.equal(requests.length,1)
  assert.equal(requests[0].url,'/api/qr/scan')
})

test('manual QR changes and assignment selection clear the prior service draft',async()=>{
  const {context,requests}=setup()
  const fieldHandler=source.slice(source.indexOf('  const handleQrFieldChange ='),source.indexOf('  const handleQrAction = async'))
  const change=runInNewContext(fieldHandler+'; handleQrFieldChange',context)
  context.historyError='Previous student history failure'
  change({target:{name:'qr_code',value:'new-student'}})
  assert.equal(context.historyError,'')
  assert.equal(context.qrFormRef.current.assignment_id,'')
  assert.equal(context.qrFormRef.current.supervising_officer_id,'')
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(requests.length,0)
  Object.assign(context.qrFormRef.current,{notes:'Previous note'})
  change({target:{name:'assignment_id',value:'22'}})
  assert.equal(context.qrFormRef.current.assignment_id,22)
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(requests[0].url,'/api/qr/scan')
  requests[0].pending.resolve(ok('new-student',{assignment:{id:22}}))
  await new Promise(resolve=>setImmediate(resolve))
})

test('polling preserves supervisor and note only for the same assignment',async()=>{
  const {action,context,requests}=setup()
  Object.assign(context.qrFormRef.current,{notes:'Current note'})
  const fields={assignment:{id:21},available_officers:[{officer_user_id:1},{officer_user_id:9}]}
  const polling=action('scan','old',{quiet:true})
  requests[0].pending.resolve(ok('old',fields))
  await polling
  assert.equal(context.qrFormRef.current.supervising_officer_id,9)
  assert.equal(context.qrFormRef.current.notes,'Current note')
  const changed=action('scan','old',{quiet:true})
  requests[1].pending.resolve(ok('old',{...fields,assignment:{id:22}}))
  await changed
  assert.equal(context.qrFormRef.current.notes,'')
})

test('Time In requires an officer and preserves the draft on failure',async()=>{
  const {action,context,requests}=setup()
  context.qrFormRef.current.supervising_officer_id=''
  assert.equal(await action('time-in','old'),false)
  assert.equal(requests.length,0)
  Object.assign(context.qrFormRef.current,{supervising_officer_id:9,notes:'Keep this note'})
  const rejected=action('time-in','old')
  requests[0].pending.resolve(new Response(JSON.stringify({success:false,message:'Unable to save'}),{status:400,headers:{'content-type':'application/json'}}))
  assert.equal(await rejected,false)
  assert.equal(context.qrFormRef.current.notes,'Keep this note')
  assert.equal(context.result,undefined)
  const confirmed=action('time-in','old')
  requests[1].pending.resolve(ok('old',{assignment:{id:21},session:{id:7,status:'ACTIVE',session_type:'OPEN_TIME',time_in:'2026-10-08T01:00:00Z'}}))
  assert.equal(await confirmed,true)
  assert.equal(context.result.session.status,'ACTIVE')
})

test('an attendance lookup from a previous account cannot update the new account',async()=>{
  const {action,context,requests}=setup()
  const pending=action('scan','old',{quiet:true})
  context.attendanceAccountRef.current=2
  requests[0].pending.resolve(ok('old',{assignment:{id:21}}))
  assert.equal(await pending,false)
  assert.equal(context.result,undefined)
  assert.equal(context.historyRequests,0)
})
