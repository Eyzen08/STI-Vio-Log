const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyAdministrativeRequest,shouldRecordAdministrativeRequest}=require('../src/middleware/administrativeAuditMiddleware');
const {denyAuthorization}=require('../src/middleware/authMiddleware');

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

test('message audit records thread content access and mutations but excludes polling and lists',()=>{
  const thread=classifyAdministrativeRequest({method:'GET',baseUrl:'/api/messages',path:'/conversations/42'});
  assert.deepEqual(thread,{action:'PRIVATE_MESSAGES_VIEW',targetType:'CONVERSATION',targetId:'42'});
  assert.equal(shouldRecordAdministrativeRequest({classification:thread,statusCode:200}),true);
  assert.equal(shouldRecordAdministrativeRequest({classification:thread,statusCode:404}),false);
  assert.equal(shouldRecordAdministrativeRequest({classification:thread,statusCode:403,authorizationDenied:true}),false);
  assert.deepEqual(classifyAdministrativeRequest({method:'POST',baseUrl:'/api/messages',path:'/conversations/42/messages'}),{action:'PRIVATE_MESSAGE_ACTION',targetType:'CONVERSATION'});
  for(const path of ['/unread-count','/conversations','/recipients'])assert.equal(classifyAdministrativeRequest({method:'GET',baseUrl:'/api/messages',path}),null);
});

test('central authorization denial marks the response to suppress duplicate route auditing',()=>{
  const response={locals:{},statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
  denyAuthorization({},response);
  assert.equal(response.locals.authorizationDenied,true);
  assert.equal(response.statusCode,403);
});
