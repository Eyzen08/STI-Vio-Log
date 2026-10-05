const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmailService, BREVO_EMAIL_ENDPOINT } = require('../src/services/emailService');

test('email service uses the Brevo HTTPS API when its credentials are configured', async () => {
  let request;
  const service=createEmailService({
    env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test',BREVO_SENDER_NAME:'STI Vio-Log'},
    fetchImpl:async(url,options)=>{request={url,options};return{ok:true,status:201}}
  });
  await service.sendOtp({to:'student@example.test',code:'654321',purpose:'STUDENT_PASSWORD_RESET'});
  assert.equal(request.url,BREVO_EMAIL_ENDPOINT);
  assert.equal(request.options.method,'POST');
  assert.equal(request.options.headers['api-key'],'private-test-key');
  const body=JSON.parse(request.options.body);
  assert.deepEqual(body.sender,{name:'STI Vio-Log',email:'verified@example.test'});
  assert.deepEqual(body.to,[{email:'student@example.test'}]);
  assert.match(body.subject,/password reset/);
  assert.match(body.textContent,/654321/);
});

test('email service converts Brevo API rejection into a bounded service error', async () => {
  const service=createEmailService({env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test'},fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(service.sendOtp({to:'student@example.test',code:'123456',purpose:'STUDENT_EMAIL_VERIFICATION'}),error=>error.statusCode===503&&error.code==='EMAIL_DELIVERY_FAILED');
});

test('email service sends OTP through an injected transport without logging or returning it', async () => {
  let message;
  const service=createEmailService({env:{MAIL_FROM:'STI Vio-Log <no-reply@example.test>'},transport:{async sendMail(value){message=value;return{messageId:'test'}}}});
  const result=await service.sendOtp({to:'student@example.test',code:'123456',purpose:'STUDENT_EMAIL_VERIFICATION'});
  assert.equal(result,undefined);
  assert.equal(message.to,'student@example.test');
  assert.equal(message.from,'STI Vio-Log <no-reply@example.test>');
  assert.match(message.text,/expires in 10 minutes/);
});

test('email service fails closed when SMTP is not configured', async () => {
  const service=createEmailService({env:{}});
  await assert.rejects(service.sendOtp({to:'student@example.test',code:'123456',purpose:'STUDENT_EMAIL_VERIFICATION'}),error=>error.code==='EMAIL_UNAVAILABLE');
});

test('email service converts SMTP failures into a bounded service error', async () => {
  const service=createEmailService({env:{MAIL_FROM:'STI Vio-Log <no-reply@example.test>'},transport:{async sendMail(){throw new Error('SMTP connection failed')}}});
  await assert.rejects(service.sendOtp({to:'student@example.test',code:'123456',purpose:'STUDENT_PASSWORD_RESET'}),error=>error.statusCode===503&&error.code==='EMAIL_DELIVERY_FAILED');
});

test('certificate email uses only the registered recipient and attaches the generated PDF', async () => {
  let request;
  const service=createEmailService({env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test'},fetchImpl:async(url,options)=>{request={url,options};return{ok:true,status:201}}});
  await service.sendCertificate({to:'student@example.test',studentName:'Maria Santos',certificateNumber:'STI-GC-COC-001',pdf:Buffer.from('%PDF-test')});
  const body=JSON.parse(request.options.body);
  assert.deepEqual(body.to,[{email:'student@example.test'}]);
  assert.equal(body.attachment[0].name,'STI-GC-COC-001.pdf');
  assert.equal(Buffer.from(body.attachment[0].content,'base64').toString(),'%PDF-test');
});

test('student credentials use Brevo with the login URL from the first configured frontend origin',async()=>{
  let body;
  const service=createEmailService({env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test',FRONTEND_URL:'https://portal.example.test,https://other.example.test'},fetchImpl:async(url,options)=>{assert.equal(url,BREVO_EMAIL_ENDPOINT);body=JSON.parse(options.body);return{ok:true}}});
  const result=await service.sendStudentCredentials({to:'student@gmail.com',studentName:'Maria Santos',studentNumber:'02000123456',temporaryPassword:'Private-test!Aa1'});
  assert.equal(result,undefined);
  assert.deepEqual(body.to,[{email:'student@gmail.com'}]);
  for(const value of ['Maria Santos','02000123456','Private-test!Aa1','https://portal.example.test/login','change this temporary password','guardian information']) assert(body.textContent.includes(value),value);
  assert(!body.textContent.includes('other.example.test'));
});

test('student credentials use SMTP and never return provider data or passwords',async()=>{
  let message;
  const service=createEmailService({env:{MAIL_FROM:'STI <mailer@example.test>',FRONTEND_URL:'http://localhost:5173'},transport:{async sendMail(value){message=value;return{accepted:[value.to],rejected:[]}}}});
  const result=await service.sendStudentCredentials({to:'student@gmail.com',studentName:'Maria Santos',studentNumber:'02000123456',temporaryPassword:'Private-test!Aa1'});
  assert.equal(result,undefined);
  assert.equal(message.to,'student@gmail.com');
  assert.equal(message.from,'STI <mailer@example.test>');
  assert.match(message.text,/http:\/\/localhost:5173\/login/);
});

test('student credential email reports missing configuration and sanitized provider failures',async()=>{
  const input={to:'student@gmail.com',studentName:'Test Student',studentNumber:'02000123456',temporaryPassword:'Private-test!Aa1'};
  await assert.rejects(createEmailService({env:{}}).sendStudentCredentials(input),e=>e.code==='EMAIL_UNAVAILABLE');
  const failures=[
    createEmailService({env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test'},fetchImpl:async()=>({ok:false,status:401})}),
    createEmailService({env:{BREVO_API_KEY:'private-test-key',BREVO_SENDER_EMAIL:'verified@example.test'},fetchImpl:async()=>{throw new Error(input.temporaryPassword)}}),
    createEmailService({env:{},transport:{async sendMail(){throw new Error(input.temporaryPassword)}}}),
    createEmailService({env:{},transport:{async sendMail(){return{rejected:['student@gmail.com']}}}})
  ];
  for(const service of failures) await assert.rejects(service.sendStudentCredentials(input),e=>e.statusCode===503&&e.code==='EMAIL_DELIVERY_FAILED'&&!e.message.includes(input.temporaryPassword));
});
