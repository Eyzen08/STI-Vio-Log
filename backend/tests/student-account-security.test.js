const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthController } = require('../src/controllers/authController');
const { createStudentOnboardingService, onboardingState } = require('../src/services/studentOnboardingService');
const { createOtpService } = require('../src/services/otpService');
const { createGoogleLinkAdministrationService } = require('../src/services/googleLinkAdministrationService');
const { createDuplicateAccountReviewService } = require('../src/services/duplicateAccountReviewService');
const { createGoogleIdentityService } = require('../src/services/googleIdentityService');
const { createPasswordChangeService } = require('../src/services/passwordChangeService');
const { createStudentPasswordAuthService } = require('../src/services/studentPasswordAuthService');
const { loadSocketAuthorization } = require('../src/realtime');
const authRoutes = require('../src/routes/authRoutes');
const { createAccountController } = require('../src/controllers/accountController');
const { ApiError } = require('../src/utils/api');

const student = { id: 9, user_id: 8, role: 'STUDENT', email: 'saved@gmail.com', onboarding_required: true, must_change_password: false, google_linked: false };
const fakePool = (handler) => {
  const calls = [];
  const query = async (sql, params = []) => { calls.push({ sql: String(sql), params }); return handler(String(sql), params); };
  return { calls, pool: { query, connect: async () => ({ query, release() {} }) } };
};

test('Google binding is unavailable through public authentication routes', () => {
  assert.equal(authRoutes.stack.some(layer => layer.route?.path === '/auth/google/link'), false);
});

test('onboarding displays the staff-recorded Gmail and keeps legacy accounts exempt', () => {
  assert.equal(onboardingState(student).onboarding_google_email, 'saved@gmail.com');
  assert.equal(onboardingState({ ...student, onboarding_required: false }).onboarding_step, 'COMPLETE');
  assert.equal(onboardingState({ ...student, onboarding_required: false, google_rebind_required: true }).onboarding_step, 'GOOGLE');
});

test('onboarding refuses a different Gmail without sending an OTP', async () => {
  const db = fakePool(sql => ({ rows: sql.includes('FROM students s JOIN users') ? [student] : [] }));
  let sent = false;
  const service = createStudentOnboardingService({ pool: db.pool, otpService: { issue: async () => { sent = true; } } });
  await assert.rejects(service.requestGoogleEmail({ userId: 8, email: 'different@gmail.com' }), error => error.code === 'GOOGLE_EMAIL_MISMATCH');
  assert.equal(sent, false);
  assert.equal(db.calls.some(call => call.sql.startsWith('UPDATE students')), false);
});

test('expired student temporary credentials fail with the generic login response', async () => {
  const controller = createAuthController({
    database: { query: async () => ({ rows: [{ ...student, id: 8, username: '02000123456', password_hash: 'hash', must_change_password: true, temporary_password_expires_at: new Date(Date.now() - 1000) }] }) },
    comparePassword: async () => true, issueToken: () => 'test-token', auditSecurityEvent: async () => true
  });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.loginUser({ body: { username: '02000123456', password: 'Temporary!123' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid username or password');
});

test('five incorrect OTPs remain counted after verification failure and block the correct code', async () => {
  let persisted = 0, pending = 0;
  const db = fakePool(sql => {
    if (sql === 'BEGIN') pending = persisted;
    if (sql === 'COMMIT') persisted = pending;
    if (sql === 'ROLLBACK') pending = persisted;
    if (sql.includes('FROM students s JOIN users')) return { rows: [{ ...student, pending_google_email: student.email }] };
    if (sql.startsWith('SELECT * FROM auth_otps')) return { rows: [{ id: 2, otp_hash: 'abcdef', target_email: student.email, attempt_count: pending, expires_at: new Date(Date.now() + 60000) }] };
    if (sql.includes('attempt_count=attempt_count+1')) pending++;
    return { rows: [] };
  });
  const otpService = createOtpService({ pool: db.pool, sendOtp: async () => {}, hash: code => code === '123456' ? 'abcdef' : 'fedcba' });
  const service = createStudentOnboardingService({ pool: db.pool, otpService });
  for (let i = 0; i < 5; i++) await assert.rejects(service.verifyGoogleEmail({ userId: 8, code: '654321' }), error => error.code === 'OTP_INVALID_OR_EXPIRED');
  assert.equal(persisted, 5);
  await assert.rejects(service.verifyGoogleEmail({ userId: 8, code: '123456' }), error => error.code === 'OTP_ATTEMPTS_EXCEEDED');
  assert.equal(db.calls.some(call => call.sql.includes('pending_google_email_verified_at=CURRENT_TIMESTAMP')), false);
});

test('staff Google recovery saves replacement Gmail, revokes sessions, and preserves profile', async () => {
  const db = fakePool(sql => ({ rows: sql.includes('SELECT gil.id') ? [{ link_id: 4, user_id: 8, email: student.email }] : [] }));
  const service = createGoogleLinkAdministrationService({ pool: db.pool });
  await service.revokeStudentLink({ actorId: 1, studentId: 9, reason: 'Student identity checked against school records', email: 'replacement@gmail.com' });
  assert(db.calls.some(call => call.sql.includes('google_rebind_required=TRUE') && call.params.includes('replacement@gmail.com')));
  assert(db.calls.some(call => call.sql.includes('UPDATE browser_sessions')));
  assert.equal(db.calls.some(call => /SET academic_level|DELETE FROM students|onboarding_completed_at=NULL/.test(call.sql)), false);
});

test('Duplicate Review returns the latest rejected conflicts separately without secret claims', async () => {
  const db = fakePool(sql => ({ rows: sql.includes('administrative_security_events') ? [{ id: 'event-1', conflict_type: 'GOOGLE_IDENTITY', occurred_at: '2026-10-09T00:00:00Z', target_label: 'Student account', reason: 'Google account already linked' }] : [] }));
  const result = await createDuplicateAccountReviewService({ pool: db.pool }).list();
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.rejected_attempts.length, 1);
  assert(db.calls.some(call => /ORDER BY.*occurred_at DESC[\s\S]*LIMIT 50/.test(call.sql)));
  assert.equal(db.calls.some(call => /SELECT.*safe_details[,\s]/.test(call.sql)), false);
});

test('password change rejects expired temporary credentials before modifying the account',async()=>{
  const db=fakePool(sql=>({rows:sql.includes('FROM users u LEFT JOIN')?[{...student,id:8,must_change_password:true,password_hash:'hash',temporary_password_expires_at:new Date(0)}]:[]}));
  const service=createPasswordChangeService({pool:db.pool,comparePassword:async()=>true,hashPassword:async()=>assert.fail('Expired password must not be replaced'),issueToken:()=>null});
  await assert.rejects(service.change({userId:8,currentPassword:'Temporary!123',newPassword:'Unique!Password123'}),error=>error.code==='CREDENTIALS_EXPIRED');
  assert.equal(db.calls.some(call=>call.sql.startsWith('UPDATE users')),false);
});

test('recovered legacy Google binding returns directly to the portal without changing academic data',async()=>{
  const db=fakePool(sql=>{
    if(sql.includes('FROM users u JOIN students'))return{rows:[{...student,id:8,student_id:9,username:'02000123456',google_rebind_required:true,onboarding_required:false,onboarding_completed_at:new Date(),pending_google_email:student.email,pending_google_email_verified_at:new Date()}]};
    if(sql.startsWith('INSERT INTO google_identity_links'))return{rows:[{id:2}]};
    return{rows:[]};
  });
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'private-identity',email:student.email,emailVerified:true}),issueToken:()=>null});
  const result=await service.linkAuthenticatedStudent({userId:8,credential:'private-token'});
  assert.equal(result.user.onboarding_step,'COMPLETE');
  assert.equal(result.user.onboarding_required,false);
  assert.equal(db.calls.some(call=>/academic_level=|onboarding_completed_at=NULL/.test(call.sql)),false);
});

test('Google identity ownership conflicts roll back and create only a safe rejected event',async()=>{
  for(const raced of [false,true]){
    const db=fakePool(sql=>{
      if(sql.includes('FROM users u JOIN students'))return{rows:[{...student,id:8,student_id:9,pending_google_email:student.email,pending_google_email_verified_at:new Date()}]};
      if(sql.startsWith('SELECT id,user_id,google_subject'))return{rows:raced?[]:[{id:2,user_id:99,google_subject:'private-identity'}]};
      if(sql.startsWith('INSERT INTO google_identity_links'))throw Object.assign(new Error('simulated concurrent unique conflict'),{code:'23505'});
      return{rows:[]};
    });
    const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'private-identity',email:student.email,emailVerified:true}),issueToken:()=>null});
    await assert.rejects(service.linkAuthenticatedStudent({userId:8,credential:'private-token'}),error=>error.code==='STUDENT_LINK_UNAVAILABLE');
    const event=db.calls.find(call=>call.sql.includes('INSERT INTO administrative_security_events'));
    assert(event);
    assert.doesNotMatch(JSON.stringify(event.params),/private-identity|private-token/);
    assert(db.calls.findIndex(call=>call.sql==='ROLLBACK')<db.calls.indexOf(event));
    assert.equal(db.calls.some(call=>call.sql.includes('google_rebind_required=FALSE')),false);
  }
});

test('a reset OTP sent to the old inbox cannot authorize recovery after the Gmail changes',async()=>{
  const db=fakePool(sql=>{
    if(sql.includes('FROM users u LEFT JOIN students'))return{rows:[{id:8,email:'old@gmail.com',purpose:'STUDENT_PASSWORD_RESET'}]};
    if(sql.startsWith('SELECT email FROM students'))return{rows:[{email:'replacement@gmail.com'}]};
    if(sql.startsWith('SELECT * FROM auth_otps'))return{rows:[{id:2,target_email:'old@gmail.com',otp_hash:'abcdef',attempt_count:0,expires_at:new Date(Date.now()+60000)}]};
    return{rows:[]};
  });
  const otpService=createOtpService({pool:db.pool,sendOtp:async()=>{},hash:()=> 'abcdef'});
  const service=createStudentPasswordAuthService({pool:db.pool,otpService});
  await assert.rejects(service.verifyPasswordReset({identifier:'02000123456',code:'123456'}),error=>error.code==='OTP_INVALID_OR_EXPIRED');
  assert.equal(db.calls.some(call=>call.sql.startsWith('INSERT INTO password_reset_authorizations')),false);
  assert(db.calls.some(call=>call.sql.startsWith('SELECT email FROM students')&&call.sql.includes('FOR UPDATE')));
});

test('realtime access rejects recovered legacy accounts until Google is rebound',async()=>{
  assert.equal(await loadSocketAuthorization(2,{query:async()=>({rows:[{...student,id:8,browser_session_id:2,onboarding_required:false,onboarding_completed_at:new Date(),google_rebind_required:true}]})}),null);
});

test('Google login creates its browser session under the identity/user lock before committing',async()=>{
  const db=fakePool(sql=>({rows:sql.includes('FROM google_identity_links gil')?[{...student,id:8,link_id:2}]:[]}));
  const service=createGoogleIdentityService({pool:db.pool,verifyIdentity:async()=>({subject:'identity',email:student.email,emailVerified:true}),issueToken:()=>null,createSession:async({database})=>{
    assert.equal(db.calls.some(call=>call.sql==='COMMIT'),false);
    assert(db.calls.some(call=>call.sql.includes('FOR UPDATE OF gil,u')));
    await database.query('INSERT INTO browser_sessions (dummy) VALUES (1)');
    return{token:'test-session',csrf:'test-csrf'};
  }});
  const result=await service.loginStudent({credential:'token'});
  assert.equal(result.session.token,'test-session');
  assert(db.calls.findIndex(call=>call.sql.startsWith('INSERT INTO browser_sessions'))<db.calls.findIndex(call=>call.sql==='COMMIT'));
});

test('password login passes the authenticated version and rejects raced recovery generically', async () => {
  const controller = createAuthController({ database: { query: async () => ({ rows: [{ ...student, id: 8, session_version: 3, password_hash: 'hash', email_verified: true }] }) }, comparePassword: async () => true, auditSecurityEvent: async () => true,
    throttles: { assertAllowed: async () => {}, success: async () => {} }, sessions: { createSession: async ({ expectedSessionVersion }) => {
      assert.equal(expectedSessionVersion, 3);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    } } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.loginUser({ body: { username: '02000123456', password: 'Old!Password123' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid username or password');
});

test('password-change session replacement rejects recovery committed after the change', async () => {
  const controller = createAccountController({ service: { change: async () => ({ user: { id: 8 }, session_version: 4 }) }, sessions: {
    revokeUserSessions: async () => {}, createSession: async ({ expectedSessionVersion }) => {
      assert.equal(expectedSessionVersion, 4);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    } } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.passwordChange({ user: { id: 8 }, body: { current_password: 'Old!Password123', new_password: 'New!Password123' }, get: () => 'test-browser' }, res);
  assert.equal(res.statusCode, 401);
});
