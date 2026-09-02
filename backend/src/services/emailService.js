const nodemailer = require('nodemailer');
const { ApiError } = require('../utils/api');

const createEmailService = ({ env = process.env, transport } = {}) => {
  const timeout = Number(env.SMTP_TIMEOUT_MS || 10000);
  const smtpTransport = transport || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
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
    if (!smtpTransport) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email verification is temporarily unavailable');
    const reset = purpose === 'STUDENT_PASSWORD_RESET';
    try {
      await smtpTransport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to,
        subject: reset ? 'STI Vio-Log password reset code' : 'Verify your STI Vio-Log email',
        text: `${reset ? 'Your password reset' : 'Your email verification'} code is ${code}. It expires in 10 minutes. Do not share this code.`
      });
    } catch (_) {
      throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'Verification email could not be sent. Please try again later');
    }
  };

  return { sendOtp };
};

module.exports = { createEmailService };
