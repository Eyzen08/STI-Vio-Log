const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleDepartmentAuthController } = require('../src/controllers/googleDepartmentAuthController');

const response = () => ({ statusCode:200, body:null, status(code){this.statusCode=code;return this;}, json(body){this.body=body;return this;} });

test('department registration maps only the public pending-account contract and never returns a session', async () => {
  let input;
  const controller = createGoogleDepartmentAuthController({ serviceFactory:()=>({ async register(value){input=value;return {pending:true,message:'Pending',registration:{id:7,status:'PENDING'}};} }) });
  const res=response();
  await controller.register({body:{credential:'token',first_name:'Ada',last_name:'Lovelace',employee_number:'E-7',department_type:'LIBRARY',department_name:'Main Library',note:'Officer'},ip:'127.0.0.1'},res);
  assert.equal(res.statusCode,202); assert.equal(res.body.pending,true); assert.equal('token' in res.body,false);
  assert.deepEqual(input,{credential:'token',firstName:'Ada',lastName:'Lovelace',employeeNumber:'E-7',departmentType:'LIBRARY',departmentName:'Main Library',note:'Officer',ipAddress:'127.0.0.1'});
});

test('department registration rejects role, department assignment, and actor overrides', async () => {
  let created=0;
  const controller=createGoogleDepartmentAuthController({serviceFactory:()=>{created+=1;return {};}});
  for (const extra of [{role:'ADMIN'},{department_id:1},{reviewed_by:1}]) {
    const res=response(); await controller.register({body:{credential:'x',first_name:'A',last_name:'B',department_type:'OTHER',department_name:'Office',...extra}},res);
    assert.equal(res.statusCode,400); assert.equal(res.body.error.code,'VALIDATION_ERROR');
  }
  assert.equal(created,0);
});

test('department Google login returns only a service-issued department session', async () => {
  const controller=createGoogleDepartmentAuthController({serviceFactory:()=>({async login(){return {token:'jwt',user:{id:4,username:'E-4',role:'DEPARTMENT_HEAD'}};}})});
  const res=response(); await controller.login({body:{credential:'token'},ip:null},res);
  assert.equal(res.statusCode,200); assert.equal(res.body.user.role,'DEPARTMENT_HEAD');
});
