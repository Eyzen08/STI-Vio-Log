import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

// Exercise the actual request handler with deferred HTTP responses, without a camera.
const source=(await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')).replace(/\r\n/g,'\n')
const EMPTY_QR_SERVICE_DRAFT=runInNewContext(source.match(/const EMPTY_QR_SERVICE_DRAFT = \{[\s\S]*?\n}/)[0]+'; EMPTY_QR_SERVICE_DRAFT')
const handler=source.slice(source.indexOf('  const handleQrAction = async'),source.indexOf('  qrActionRef.current=handleQrAction'))
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
const setup=()=>{
  const requests=[]
  const context={EMPTY_QR_SERVICE_DRAFT,qrForm:{qr_code:'old'},qrFormRef:{current:{qr_code:'old',assignment_id:21,supervising_officer_id:9,session_type:'OPEN_TIME',selected_duration_minutes:null,notes:'Old student note'}},qrActionBusyRef:{current:null},qrInputVersionRef:{current:0},verifiedQrRef:{current:'old'},user:{id:1},token:'test',API_URL:'',sessionStorage:{setItem(){},removeItem(){}},isAdmin:false,setDashboardRefreshKey(){},refreshPendingActions(){},setQrInputSource(){},
    setQrResult(value){context.result=typeof value==='function'?value(context.result):value},setVerifiedQr(value){context.verified=value},setQrError(value){context.error=value},setQrSubmitting(){},setQrHistory(){},setQrForm(update){context.qrFormRef.current=typeof update==='function'?update(context.qrFormRef.current):update},
    fetch(url,options){if(url.endsWith('/sessions')) return Promise.resolve({ok:true,json:async()=>({sessions:[]})});const pending=deferred();requests.push({url,options,pending});return pending.promise}}
  const action=runInNewContext(handler+'; handleQrAction',context)
  return {action,context,requests}
}
const ok=(code,fields={})=>({ok:true,json:async()=>({success:true,student:{qr_code:code},...fields})})

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
  requests[0].pending.resolve({ok:false,json:async()=>({success:false,message:'Old failure'})})
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
  const block=source.slice(source.indexOf('  useEffect(()=>{\n    if(activeView'),source.indexOf("  },[activeView,token,user?.id,realtimeSocket])"))+'  })'
  const calls=[]
  let refresh
  const context={activeView:'QR Scan',token:'test',user:{id:1},qrFormRef:{current:{qr_code:'typed'}},verifiedQrRef:{current:''},qrActionRef:{current(...args){calls.push(args)}},sessionStorage:{getItem(){return 'previous'}},document:{visibilityState:'visible',addEventListener(){}},window:{setInterval(callback){refresh=callback},addEventListener(){}},realtimeSocket:null,useEffect(effect){effect()}}
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
  const context={EMPTY_QR_SERVICE_DRAFT,qrDecodeBusyRef:{current:false},qrInputVersionRef:{current:0},qrFormRef:{current:{session_type:'OPEN_TIME',assignment_id:21,supervising_officer_id:9,notes:'Previous note'}},verifiedQrRef:{current:'previous'},scanner:{},setQrInputSource(value){context.inputSource=value},setQrForm(){},setVerifiedQr(){},setQrResult(){},setQrHistory(){},setQrError(){},stopQrScanner:async()=>{},qrActionRef:{current:async(...args)=>{calls.push(args)}}}
  runInNewContext('('+callback+')',context)(' camera-code ')
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,[['scan','camera-code']])
  assert.equal(context.inputSource,'camera')
  assert.equal(context.qrFormRef.current.qr_code,'camera-code')
  assert.equal(context.qrFormRef.current.session_type,'')
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
  const context={EMPTY_QR_SERVICE_DRAFT,qrDecodeBusyRef:{current:false},qrInputVersionRef:{current:0},qrFormRef:{current:{}},verifiedQrRef:{current:''},scanner:{},setQrInputSource(){},setQrForm(){},setVerifiedQr(){},setQrResult(){},setQrHistory(){},setQrError(){},stopQrScanner:()=>stop.promise,qrActionRef:{current:async(...args)=>{calls.push(args)}}}
  runInNewContext('('+source.slice(start,end)+'\n        })',context)('camera-code')
  context.qrInputVersionRef.current++
  context.qrFormRef.current.qr_code='manual-code'
  stop.resolve()
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(calls.length,0)
  assert.equal(context.qrFormRef.current.qr_code,'manual-code')
  assert.equal(context.qrDecodeBusyRef.current,false)
})

test('fresh verification clears Open Time and notes and never submits Time In',async()=>{
  const {action,context,requests}=setup()
  const checking=action('scan','new-student')
  requests[0].pending.resolve(ok('new-student',{assignment:{id:22},available_officers:[{officer_user_id:10}]}))
  await checking
  assert.equal(context.qrFormRef.current.session_type,'')
  assert.equal(context.qrFormRef.current.selected_duration_minutes,null)
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
  change({target:{name:'qr_code',value:'new-student'}})
  assert.equal(context.qrFormRef.current.session_type,'')
  assert.equal(context.qrFormRef.current.assignment_id,'')
  assert.equal(context.qrFormRef.current.supervising_officer_id,'')
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(requests.length,0)
  Object.assign(context.qrFormRef.current,{session_type:'FIXED',selected_duration_minutes:120,notes:'Previous note'})
  change({target:{name:'assignment_id',value:'22'}})
  assert.equal(context.qrFormRef.current.assignment_id,22)
  assert.equal(context.qrFormRef.current.session_type,'')
  assert.equal(context.qrFormRef.current.notes,'')
  assert.equal(requests[0].url,'/api/qr/scan')
  requests[0].pending.resolve(ok('new-student',{assignment:{id:22}}))
  await new Promise(resolve=>setImmediate(resolve))
})

test('polling preserves a chosen duration, supervisor and note only for the same assignment',async()=>{
  const {action,context,requests}=setup()
  Object.assign(context.qrFormRef.current,{session_type:'FIXED',selected_duration_minutes:180,notes:'Current note'})
  const fields={assignment:{id:21},available_officers:[{officer_user_id:1},{officer_user_id:9}]}
  const polling=action('scan','old',{quiet:true})
  requests[0].pending.resolve(ok('old',fields))
  await polling
  assert.equal(context.qrFormRef.current.selected_duration_minutes,180)
  assert.equal(context.qrFormRef.current.supervising_officer_id,9)
  assert.equal(context.qrFormRef.current.notes,'Current note')
  const changed=action('scan','old',{quiet:true})
  requests[1].pending.resolve(ok('old',{...fields,assignment:{id:22}}))
  await changed
  assert.equal(context.qrFormRef.current.session_type,'')
  assert.equal(context.qrFormRef.current.notes,'')
})

test('Time In requires selection, preserves it on failure and starts only after confirmation',async()=>{
  const {action,context,requests}=setup()
  context.qrFormRef.current.session_type=''
  assert.equal(await action('time-in','old'),false)
  assert.equal(requests.length,0)
  for(const [type,minutes] of [['FIXED',120],['OPEN_TIME',null],['FIXED',45]]) {
    Object.assign(context.qrFormRef.current,{session_type:type,selected_duration_minutes:minutes})
    const rejected=action('time-in','old')
    const request=requests.at(-1)
    const body=JSON.parse(request.options.body)
    assert.equal(body.session_type,type)
    assert.equal(body.selected_duration_minutes,minutes)
    request.pending.resolve({ok:false,json:async()=>({success:false,message:'Unable to save'})})
    assert.equal(await rejected,false)
    assert.equal(context.qrFormRef.current.session_type,type)
    assert.equal(context.result,undefined)
  }
  const confirmed=action('time-in','old')
  requests.at(-1).pending.resolve(ok('old',{assignment:{id:21},session:{id:7,status:'ACTIVE',session_type:'FIXED',time_in:'2026-10-08T01:00:00Z'}}))
  assert.equal(await confirmed,true)
  assert.equal(context.result.session.status,'ACTIVE')
})
