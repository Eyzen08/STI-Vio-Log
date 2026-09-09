const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyAdministrativeRequest}=require('../src/middleware/administrativeAuditMiddleware');

test('sensitive administrative actions are classified without request bodies',()=>{
  assert.equal(classifyAdministrativeRequest({method:'PATCH',baseUrl:'/api/violations',path:'/9'}).action,'VIOLATION_ADMIN_ACTION');
  assert.equal(classifyAdministrativeRequest({method:'GET',baseUrl:'/api/parent-contact',path:'/7'}).action,'GUARDIAN_CONTACT_VIEW');
  assert.equal(classifyAdministrativeRequest({method:'GET',baseUrl:'/api/reports',path:'/violations.csv'}).action,'SENSITIVE_DATA_EXPORT');
  assert.equal(classifyAdministrativeRequest({method:'GET',baseUrl:'/api/violations',path:'/9'}),null);
});

test('audit classifier never includes query strings or submitted content',()=>{
  const classified=classifyAdministrativeRequest({method:'POST',baseUrl:'/api/messages',path:'/conversations/4/messages',originalUrl:'/api/messages/conversations/4/messages?token=secret'});
  assert.deepEqual(classified,{action:'PRIVATE_MESSAGE_ACTION',targetType:'CONVERSATION'});
  assert.doesNotMatch(JSON.stringify(classified),/secret|message content/i);
});
