const test=require('node:test');
const assert=require('node:assert/strict');
const {createAuthController}=require('../src/controllers/authController');

const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const requestFor=(username,password)=>({body:{username,password}});

for(const role of ['ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD','STUDENT'])test(`valid ${role} password login derives its role from the database`,async()=>{
  const controller=createAuthController({database:{async query(sql,params){if(sql.startsWith('UPDATE users')){assert.equal(params[0],4);return{rows:[]}}assert.equal(params[0],'account');assert.equal(sql.includes('role=$'),false);return{rows:[{id:4,username:'account',role,password_hash:'hash',session_version:1,must_change_password:false,email_verified:true}]}}},comparePassword:async()=>true,jwtSecret:()=> 's'.repeat(48),issueToken:user=>`token-${user.role}`});
  const res=response();await controller.loginUser(requestFor('account','Password@123'),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.user.role,role);assert.equal(res.body.token,`token-${role}`);
});

test('invalid username and invalid password use the same generic response',async()=>{
  const missing=createAuthController({database:{async query(){return{rows:[]}}},comparePassword:async()=>false});
  const wrong=createAuthController({database:{async query(){return{rows:[{password_hash:'hash'}]}}},comparePassword:async()=>false});
  const first=response(),second=response();await missing.loginUser(requestFor('missing','Wrong@123'),first);await wrong.loginUser(requestFor('account','Wrong@123'),second);
  assert.equal(first.statusCode,401);assert.equal(second.statusCode,401);assert.equal(first.body.message,second.body.message);
});
