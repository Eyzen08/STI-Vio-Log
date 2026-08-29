const crypto = require('crypto');

const secret = () => process.env.JWT_SECRET || '';
const signatureFor = (clearanceId) => crypto.createHmac('sha256', secret()).update(`clearance:${clearanceId}`).digest('base64url');
const certificateCode = (clearanceId) => `CLR-${clearanceId}-${signatureFor(clearanceId)}`;

const clearanceIdFromCode = (code) => {
  const match = /^CLR-(\d+)-([A-Za-z0-9_-]{43})$/.exec(String(code || ''));
  if (!match || !secret()) return null;
  const expected = signatureFor(match[1]);
  const supplied = match[2];
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)) ? Number(match[1]) : null;
};

module.exports = { certificateCode, clearanceIdFromCode };
