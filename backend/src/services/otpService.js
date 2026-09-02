const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

const hashSecret = (value, secret = process.env.JWT_SECRET) =>
  crypto.createHmac('sha256', secret).update(String(value)).digest('hex');

const secureOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const createOtpService = ({ pool, sendOtp, now = () => new Date(), generateOtp = secureOtp, hash = hashSecret } = {}) => {
  if (!pool?.connect || typeof sendOtp !== 'function') throw new TypeError('OTP dependencies are required');

  const issue = async ({ purpose, userId = null, registrationId = null, email }) => {
    const client = await pool.connect();
    let code;
    try {
      await client.query('BEGIN');
      const ownerColumn = registrationId ? 'registration_id' : 'user_id';
      const ownerId = Number(registrationId || userId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('auth-otp:' || $1 || ':' || $2::text))", [purpose, ownerId]);
      const prior = (await client.query(
        `SELECT id,created_at FROM auth_otps WHERE ${ownerColumn}=$1 AND purpose=$2 AND used_at IS NULL FOR UPDATE`,
        [ownerId, purpose]
      )).rows[0];
      if (prior && now().getTime() - new Date(prior.created_at).getTime() < OTP_RESEND_SECONDS * 1000) {
        throw new ApiError(429, 'OTP_RESEND_LIMITED', 'Please wait before requesting another code');
      }
      if (prior) await client.query('UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP WHERE id=$1', [prior.id]);
      code = generateOtp();
      const expiresAt = new Date(now().getTime() + OTP_TTL_MINUTES * 60 * 1000);
      await client.query(
        `INSERT INTO auth_otps(user_id,registration_id,purpose,otp_hash,expires_at)
         VALUES($1,$2,$3,$4,$5)`,
        [userId, registrationId, purpose, hash(code), expiresAt]
      );
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally { client.release(); }
    try {
      await sendOtp({ to: email, code, purpose });
    } catch (error) {
      await pool.query(
        `UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP
         WHERE purpose=$1 AND used_at IS NULL
           AND (($2::bigint IS NOT NULL AND registration_id=$2) OR ($3::bigint IS NOT NULL AND user_id=$3))`,
        [purpose, registrationId, userId]
      );
      throw error;
    }
  };

  const verify = async ({ purpose, userId = null, registrationId = null, code, client }) => {
    if (!/^\d{6}$/.test(String(code || ''))) throw new ApiError(400, 'INVALID_OTP', 'Enter the 6-digit verification code');
    const ownerColumn = registrationId ? 'registration_id' : 'user_id';
    const ownerId = Number(registrationId || userId);
    const row = (await client.query(
      `SELECT * FROM auth_otps WHERE ${ownerColumn}=$1 AND purpose=$2 AND used_at IS NULL FOR UPDATE`,
      [ownerId, purpose]
    )).rows[0];
    if (!row || new Date(row.expires_at) <= now()) throw new ApiError(400, 'OTP_INVALID_OR_EXPIRED', 'Verification code is invalid or expired');
    if (Number(row.attempt_count) >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many verification attempts');
    const valid = crypto.timingSafeEqual(Buffer.from(row.otp_hash), Buffer.from(hash(code)));
    if (!valid) {
      await client.query('UPDATE auth_otps SET attempt_count=attempt_count+1 WHERE id=$1', [row.id]);
      throw new ApiError(400, 'OTP_INVALID_OR_EXPIRED', 'Verification code is invalid or expired');
    }
    await client.query('UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP WHERE id=$1', [row.id]);
    return row;
  };

  return { issue, verify };
};

module.exports = { createOtpService, secureOtp, hashSecret, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS };
