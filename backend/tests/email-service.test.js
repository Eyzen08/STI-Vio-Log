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
