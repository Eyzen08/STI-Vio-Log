const test = require('node:test')
const assert = require('node:assert/strict')
const router = require('../src/routes/officerResponsibilityRoutes')
const { createOfficerResponsibilityController } = require('../src/controllers/officerResponsibilityController')
const { createOfficerResponsibilityService } = require('../src/services/officerResponsibilityService')
const { chooseSupervisor } = require('../src/services/communityServiceSessionService')

const response = () => ({ statusCode:200, body:null, status(code){this.statusCode=code;return this}, json(body){this.body=body;return this} })

test('officer responsibility routes expose assignment lifecycle operations', () => {
  const routes = router.stack.filter((item)=>item.route).map((item)=>`${Object.keys(item.route.methods)[0].toUpperCase()} ${item.route.path}`)
  assert.deepEqual(routes, ['GET /','POST /permanent','POST /temporary','PATCH /officers/:officerId/availability','PATCH /temporary/:assignmentId'])
})

test('officer responsibility controller derives the administrator identity', async () => {
  let received
  const controller = createOfficerResponsibilityController({ service:{ async createTemporary(input){received=input;return{id:7}} } })
  const res = response()
  await controller.temporary({ user:{id:4}, body:{original_officer_id:8,replacement_officer_id:9,department_id:2,reason:'Approved leave'} }, res)
  assert.equal(res.statusCode, 201)
  assert.equal(received.actorId, 4)
  assert.equal(received.originalOfficerId, 8)
})

test('temporary responsibility requires an absent original and persists history in one transaction', async () => {
  const queries=[]
  const client={async query(sql,params=[]){const text=String(sql);queries.push(text)
    if(text.includes('RETURNING id,department_id,officer_user_id'))return{rows:[]}
    if(text.includes('FROM users WHERE id=ANY'))return{rows:[{id:8,role:'DEPARTMENT_HEAD',is_active:true},{id:9,role:'DISCIPLINE_OFFICE',is_active:true}]}
    if(text.includes('FROM departments WHERE id='))return{rows:[{id:2,is_active:true}]}
    if(text.includes("assignment_type='PERMANENT'"))return{rows:[{exists:true}]}
    if(text.includes('FROM officer_availability')&&Number(params[0])===8)return{rows:[{availability_status:'ABSENT'}]}
    if(text.includes('FROM officer_availability')&&Number(params[0])===9)return{rows:[{availability_status:'AVAILABLE'}]}
    if(text.includes("assignment_type='TEMPORARY'")&&text.includes('LIMIT 1'))return{rows:[]}
    if(text.includes('INSERT INTO officer_department_assignments'))return{rows:[{id:22,officer_user_id:9,original_officer_user_id:8,department_id:2,status:'ACTIVE'}]}
    return{rows:[]}
  },release(){}}
  const service=createOfficerResponsibilityService({pool:{connect:async()=>client,query:async()=>({rows:[]})}})
  const row=await service.createTemporary({actorId:4,originalOfficerId:8,replacementOfficerId:9,departmentId:2,reason:'Approved leave'})
  assert.equal(row.id,22)
  assert.equal(queries[0],'BEGIN')
  assert.equal(queries.at(-1),'COMMIT')
  assert.equal(queries.some((sql)=>sql.includes('OFFICER_TEMPORARY_ASSIGNMENT')),true)
})

test('expired temporary responsibilities restore normal selection and are audited', async () => {
  const queries=[]
  const client={async query(sql){const text=String(sql);queries.push(text)
    if(text.includes('RETURNING id,department_id,officer_user_id'))return{rows:[{id:3,department_id:2,officer_user_id:9,original_officer_user_id:8}]}
    if(text.includes('SELECT u.id AS officer_user_id'))return{rows:[{officer_user_id:8,assignment_type:'PERMANENT'}]}
    return{rows:[]}
  },release(){}}
  const service=createOfficerResponsibilityService({pool:{connect:async()=>client,query:async()=>({rows:[]})}})
  const available=await service.available({departmentId:2})
  assert.equal(available[0].officer_user_id,8)
  assert.equal(queries.some((sql)=>sql.includes('OFFICER_TEMPORARY_EXPIRED')),true)
  assert.equal(queries.at(-1),'COMMIT')
})

test('attendance rejects a selected officer outside the authorized available set', async () => {
  const client={query:async()=>({rows:[{officer_user_id:8,assignment_type:'PERMANENT'}]})}
  await assert.rejects(
    chooseSupervisor(client,{departmentId:2,selectedOfficerId:99}),
    (error)=>error.code==='UNAUTHORIZED_OFFICER'&&error.statusCode===403
  )
})

test('active attendance may transfer only to the authorized temporary replacement', async () => {
  const client={query:async()=>({rows:[{officer_user_id:9,assignment_type:'TEMPORARY',original_officer_user_id:8}]})}
  const selected=await chooseSupervisor(client,{departmentId:2,selectedOfficerId:9,currentOfficerId:8})
  assert.equal(selected.officer_user_id,9)
  await assert.rejects(
    chooseSupervisor({query:async()=>({rows:[{officer_user_id:10,assignment_type:'PERMANENT'}]})},{departmentId:2,selectedOfficerId:10,currentOfficerId:8}),
    (error)=>error.code==='OFFICER_TRANSFER_REQUIRED'
  )
})
