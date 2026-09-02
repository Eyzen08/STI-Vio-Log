const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmailService } = require('../src/services/emailService');

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
