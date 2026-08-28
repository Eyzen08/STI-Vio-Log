const LOCAL_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];
const INSECURE_JWT_DEFAULTS = new Set(['sti-vio-log-dev-secret-change-me', 'change-this-to-a-long-random-secret']);
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const parseOrigins = (value) => String(value || '').split(',').map((origin) => origin.trim()).filter(Boolean);

const validateSecureConfig = (environment = process.env) => {
  const errors = [];
  const production = environment.NODE_ENV === 'production';
  const jwtSecret = environment.JWT_SECRET || '';
  if (jwtSecret.length < 32 || INSECURE_JWT_DEFAULTS.has(jwtSecret)) errors.push('JWT_SECRET must contain at least 32 non-placeholder characters');
  const hasUrl = Boolean(environment.DATABASE_URL);
  const hasParts = [environment.DB_HOST, environment.DB_PORT, environment.DB_NAME, environment.DB_USER, environment.DB_PASSWORD].every(Boolean);
  if (!hasUrl && !hasParts) errors.push('Configure DATABASE_URL or every required DB_* value');
  const origins = parseOrigins(environment.FRONTEND_URL);
  if (production && origins.length === 0) errors.push('FRONTEND_URL is required in production');
  if (production && origins.some((origin) => !origin.startsWith('https://') || /localhost|127\.0\.0\.1/i.test(origin))) errors.push('Production FRONTEND_URL entries must be public HTTPS origins');
  if (production && environment.GOOGLE_CLIENT_ID && !environment.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) errors.push('GOOGLE_CLIENT_ID must be a Google web client ID');
  if (errors.length) throw new Error(`Secure configuration validation failed: ${errors.join('; ')}`);
  return { production, origins };
};

const allowedOriginsFor = (environment = process.env) => {
  const configured = parseOrigins(environment.FRONTEND_URL);
  const origins = environment.NODE_ENV === 'production' ? configured : [...configured, ...LOCAL_ORIGINS];
  return [...new Set(origins)];
};

module.exports = { allowedOriginsFor, CORS_METHODS, parseOrigins, validateSecureConfig };
