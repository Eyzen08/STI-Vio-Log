const test=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const router=require('../src/routes/accountRoutes');
const {issueSessionToken}=require('../src/services/sessionTokenService');

test('account route exposes password and administrator self-service settings',()=>{
  const routes=router.stack.filter(layer=>layer.route).map(layer=>({path:layer.route.path,methods:Object.keys(layer.route.methods)}));
  assert.deepEqual(routes,[{path:'/password-change',methods:['post']},{path:'/student-onboarding/google-email/request',methods:['post']},{path:'/student-onboarding/google-email/verify',methods:['post']},{path:'/student-onboarding/google-link',methods:['post']},{path:'/student-onboarding/profile',methods:['post']},{path:'/admin-profile',methods:['get']},{path:'/admin-profile',methods:['patch']},{path:'/admin-profile/email/resend',methods:['post']},{path:'/admin-profile/email/verify',methods:['post']}]);
});

test('legacy development tokens are constrained and disabled in production',()=>{
  const secret='this-is-a-secure-test-secret-123456';
  const token=issueSessionToken({id:7,username:'officer',role:'DISCIPLINE_OFFICE',session_version:4,must_change_password:true},{env:{JWT_SECRET:secret},expiresIn:'1h'});
  const payload=jwt.verify(token,secret);
  assert.equal(payload.session_version,4);assert.equal(payload.password_change_required,true);
  assert.equal('password' in payload,false);assert.equal('password_hash' in payload,false);
  assert.equal(payload.purpose,'legacy-session');
  assert.throws(()=>issueSessionToken({id:7},{env:{NODE_ENV:'production',JWT_SECRET:secret}}),/disabled in production/);
});
