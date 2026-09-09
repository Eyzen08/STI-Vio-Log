const pool = require('../config/database');

const SECRET_KEY = /(password|hash|otp|token|credential|secret|google_sub|authorization|cookie)/i;
const safeText = (value, max = 500) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : null;
const sanitizeDetails = (value, depth = 0) => {
  if (depth > 3 || value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => sanitizeDetails(entry, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, entry]) => [
    safeText(key, 100),
    SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeDetails(entry, depth + 1)
  ]));
  if (typeof value === 'string') return safeText(value, 500);
  return typeof value === 'number' || typeof value === 'boolean' ? value : null;
};

const recordSecurityEvent = async ({
  actor, action, targetType, targetId, targetLabel, details, reason, result,
  ipAddress, userAgent, requestId, supportAccessRequestId, database = pool
}) => {
  try {
    await database.query(
      `INSERT INTO administrative_security_events(
       actor_user_id,actor_readable_name,actor_role,effective_permissions,action,target_type,target_id,target_label,
       safe_details,reason,ip_address,user_agent,request_id,result,support_access_request_id)
       VALUES($1,$2,$3,$4::text[],$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15)`,
      [actor?.id || null, safeText(actor?.username,255), safeText(actor?.role,50), actor?.permissions || [],
       safeText(action,100), safeText(targetType,100), safeText(String(targetId || ''),100) || null, safeText(targetLabel,255),
       JSON.stringify(sanitizeDetails(details) || {}), safeText(reason,1000), ipAddress || null, safeText(userAgent,500),
       requestId || null, result, supportAccessRequestId || null]
    );
    return true;
  } catch (error) {
    console.error('[SECURITY_AUDIT] Failed to persist security event');
    return false;
  }
};

module.exports = { SECRET_KEY, sanitizeDetails, recordSecurityEvent };
