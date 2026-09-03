const nodemailer = require('nodemailer');
const { ApiError } = require('../utils/api');

const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const createEmailService = ({ env = process.env, transport, fetchImpl = global.fetch } = {}) => {
  const configuredTimeout = Number(env.EMAIL_TIMEOUT_MS || env.SMTP_TIMEOUT_MS || 10000);
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 10000;
  const useBrevo = !transport && Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
  const smtpTransport = transport || (!useBrevo && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: String(env.SMTP_SECURE).toLowerCase() === 'true',
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: timeout,
        greetingTimeout: timeout,
        socketTimeout: timeout
      })
    : null);

  const sendOtp = async ({ to, code, purpose }) => {
    const reset = purpose === 'STUDENT_PASSWORD_RESET' || purpose === 'ADMIN_PASSWORD_RESET';
    const subject = reset ? 'STI Vio-Log password reset code' : 'Verify your STI Vio-Log email';
    const text = `${reset ? 'Your password reset' : 'Your email verification'} code is ${code}. It expires in 10 minutes. Do not share this code.`;
    try {
      if (useBrevo) {
        if (typeof fetchImpl !== 'function') throw new Error('HTTPS email client is unavailable');
        const response = await fetchImpl(BREVO_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: env.BREVO_SENDER_NAME || 'STI Vio-Log', email: env.BREVO_SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            textContent: text
          }),
          signal: AbortSignal.timeout(timeout)
        });
        if (!response.ok) throw new Error('Email provider rejected the request');
        return;
      }
      if (!smtpTransport) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email verification is temporarily unavailable');
      await smtpTransport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to,
        subject,
        text
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'Verification email could not be sent. Please try again later');
    }
  };

  const sendCertificate = async ({ to, studentName, certificateNumber, pdf }) => {
    const subject = 'STI Vio-Log Certificate of Compliance';
    const text = `Good day ${studentName},\n\nYour Certificate of Compliance (${certificateNumber}) is attached. Keep this official document for your records.`;
    try {
      if (useBrevo) {
        if (typeof fetchImpl !== 'function') throw new Error('HTTPS email client is unavailable');
        const response = await fetchImpl(BREVO_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: { accept: 'application/json', 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { name: env.BREVO_SENDER_NAME || 'STI Vio-Log', email: env.BREVO_SENDER_EMAIL },
            to: [{ email: to }], subject, textContent: text,
            attachment: [{ name: `${certificateNumber}.pdf`, content: pdf.toString('base64') }]
          }),
          signal: AbortSignal.timeout(timeout)
        });
        if (!response.ok) throw new Error('Email provider rejected the request');
        return;
      }
      if (!smtpTransport) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Certificate email is temporarily unavailable');
      await smtpTransport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text, attachments: [{ filename: `${certificateNumber}.pdf`, content: pdf, contentType: 'application/pdf' }] });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'Certificate email could not be delivered');
    }
  };

  return { sendOtp, sendCertificate };
};

module.exports = { createEmailService, BREVO_EMAIL_ENDPOINT };
