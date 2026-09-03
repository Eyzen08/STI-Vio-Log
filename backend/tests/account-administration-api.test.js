const test=require('node:test');
const assert=require('node:assert/strict');
const router=require('../src/routes/accountAdministrationRoutes');
const {createAccountAdministrationController}=require('../src/controllers/accountAdministrationController');
const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});

test('account administration routes expose the designed mutation surface',()=>{const routes=router.stack.filter(x=>x.route).map(x=>`${Object.keys(x.route.methods)[0].toUpperCase()} ${x.route.path}`);assert.deepEqual(routes,['GET /','POST /','POST /department-officer','PATCH /:id/status','PATCH /:id/assignment','PATCH /:id/profile','POST /:id/password-reset'])});

test('unified department creation derives actor identity and accepts only designed fields',async()=>{let received;const controller=createAccountAdministrationController({service:{async createDepartmentOfficer(input){received=input;return{account:{id:9},department:{id:3},temporary_password:'once'}}}});const res=response();await controller.createDepartmentOfficer({user:{id:4},body:{department_name:'Library',department_type:'Academic Support',username:'library.head',role:'DEPARTMENT_HEAD',first_name:'A',last_name:'B'}},res);assert.equal(res.statusCode,201);assert.equal(received.actorId,4);assert.equal(received.departmentName,'Library');assert.equal(res.body.temporary_password,'once')});

test('account creation derives the actor and rejects privileged field overrides',async()=>{let called=false;const controller=createAccountAdministrationController({service:{async create(){called=true}}});const res=response();await controller.create({user:{id:4},body:{username:'x',role:'ADMIN',first_name:'A',last_name:'B',is_active:true}},res);assert.equal(res.statusCode,400);assert.equal(called,false)});

test('temporary password is returned only by explicit creation/reset contracts',async()=>{const controller=createAccountAdministrationController({service:{async create(input){assert.equal(input.actorId,4);return{account:{id:8},temporary_password:'one-time'}},async resetPassword(){return{account_id:8,temporary_password:'reset-once'}}}});let res=response();await controller.create({user:{id:4},body:{username:'officer',role:'DISCIPLINE_OFFICE',first_name:'A',last_name:'B'}},res);assert.equal(res.body.temporary_password,'one-time');res=response();await controller.reset({user:{id:4},params:{id:'8'},body:{reason:'recovery'}},res);assert.equal(res.body.temporary_password,'reset-once')});
