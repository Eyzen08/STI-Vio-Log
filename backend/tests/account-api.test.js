const test=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const router=require('../src/routes/accountRoutes');
const {issueSessionToken}=require('../src/services/sessionTokenService');

test('account route exposes only authenticated self-service password change',()=>{
  const routes=router.stack.filter(layer=>layer.route).map(layer=>({path:layer.route.path,methods:Object.keys(layer.route.methods)}));
  assert.deepEqual(routes,[{path:'/password-change',methods:['post']}]);
});

test('session tokens carry version and forced-change state',()=>{
  const secret='this-is-a-secure-test-secret-123456';
  const token=issueSessionToken({id:7,username:'officer',role:'DISCIPLINE_OFFICE',session_version:4,must_change_password:true},{env:{JWT_SECRET:secret},expiresIn:'1h'});
  const payload=jwt.verify(token,secret);
  assert.equal(payload.session_version,4);assert.equal(payload.password_change_required,true);
  assert.equal('password' in payload,false);assert.equal('password_hash' in payload,false);
});
