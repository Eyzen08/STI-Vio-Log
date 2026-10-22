import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { apiRequest } from '../src/lib/api.js'

const sources = await Promise.all(['ServiceAttendanceControls', 'ServiceTimeOutDialog', 'ServiceDayInvalidation'].map(async name =>
  (await readFile(new URL(`../src/components/${name}.jsx`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')))
const writes = [sources[0].slice(sources[0].indexOf('  const change = async'), sources[0].indexOf('  return <>')),
  sources[1].slice(sources[1].indexOf('  const save = async'), sources[1].indexOf('  const preview=data?.preview')),
  sources[2].slice(sources[2].indexOf('  const save=async'), sources[2].indexOf('  return <Modal title="Invalidate Service Day"'))]

function setup(responses) {
  const calls = []
  const state = { pending:{current:false}, disabled:false, limitReached:false, reason:'Break', busy:false, notes:'', officerId:9,
    session:{id:42,assignment_id:21,student_id:1}, data:{preview_version:'v1'}, token:'test', API_URL:'', url:'/api/community-service/21/days/2026-10-22',
    setBusy(value){state.busy=value}, setError(value){state.error=value}, setDialog(){}, setReason(){}, setData(value){state.data=value},
    onSaved(){state.saved=true}, onClose(){state.closed=true},
    fetch(url, options){calls.push({url,options});return Promise.resolve(responses.shift())},
    apiRequest(path,options){const original=globalThis.fetch;globalThis.fetch=state.fetch;try{return apiRequest(path,options)}finally{globalThis.fetch=original}}
  }
  return {state,calls}
}

test('Pause, Time Out and invalidation display readable HTML errors without retrying writes',async()=>{
  for(const [index,handler] of writes.entries()){
    const {state,calls}=setup([new Response('<!DOCTYPE html>',{status:502,headers:{'content-type':'text/html'}})])
    const save=runInNewContext(`${handler}; ${index===0?'change':'save'}`,state)
    await save(index===0?'pause':{preventDefault(){}})
    assert.equal(state.error,'The service is temporarily unavailable. Please try again.')
    assert.equal(state.saved,undefined)
    assert.equal(state.busy,false)
    assert.equal(calls.length,1)
    assert.equal(calls[0].options.method,'POST')
  }
})

test('stale invalidation previews refresh once without repeating the destructive write',async()=>{
  const {state,calls}=setup([
    new Response(JSON.stringify({success:false,error:{code:'STALE_DAY_PREVIEW',message:'Attendance changed. Review the updated day.'}}),{status:409,headers:{'content-type':'application/json'}}),
    new Response(JSON.stringify({success:true,preview_version:'v2'}),{headers:{'content-type':'application/json'}})
  ])
  const save=runInNewContext(`${writes[2]}; save`,state)
  await save({preventDefault(){}})
  assert.equal(state.data.preview_version,'v2')
  assert.equal(state.error,'Attendance changed. Review the updated day.')
  assert.equal(state.saved,undefined)
  assert.equal(calls.length,2)
  assert.equal(calls.filter(call=>call.options.method==='POST').length,1)
  assert.match(calls[1].url,/\/invalidation-preview$/)
})
