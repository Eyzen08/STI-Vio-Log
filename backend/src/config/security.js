const LOCAL_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];
const INSECURE_JWT_DEFAULTS = new Set(['sti-vio-log-dev-secret-change-me', 'change-this-to-a-long-random-secret']);
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const parseOrigins = (value) => String(value || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const looksPlaceholder = (value) => /replace|change[-_ ]?me|placeholder|example|development|test[-_ ]?secret/i.test(String(value || ''));

const validateSecureConfig = (environment = process.env) => {
  const errors = [];
  const production = environment.NODE_ENV === 'production';
  const deploymentEnvironment = String(environment.DEPLOYMENT_ENV || '').toLowerCase();
  const databaseEnvironment = String(environment.DATABASE_ENVIRONMENT || '').toLowerCase();
  if (production && !['production','staging'].includes(deploymentEnvironment)) errors.push('DEPLOYMENT_ENV must be production or staging');
  if (production && databaseEnvironment !== deploymentEnvironment) errors.push('DATABASE_ENVIRONMENT must exactly match DEPLOYMENT_ENV');
  const trustProxyHops = Number(environment.TRUST_PROXY_HOPS);
  if (production && (!Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 3)) errors.push('TRUST_PROXY_HOPS must explicitly match the 1-3 trusted reverse-proxy hops');
  const jwtSecret = environment.JWT_SECRET || '';
  if (jwtSecret.length < 32 || INSECURE_JWT_DEFAULTS.has(jwtSecret) || looksPlaceholder(jwtSecret)) errors.push('JWT_SECRET must contain at least 32 non-placeholder characters');
  const hasUrl = Boolean(environment.DATABASE_URL);
  const hasParts = [environment.DB_HOST, environment.DB_PORT, environment.DB_NAME, environment.DB_USER, environment.DB_PASSWORD].every(Boolean);
  if (!hasUrl && !hasParts) errors.push('Configure DATABASE_URL or every required DB_* value');
  const origins = parseOrigins(environment.FRONTEND_URL);
  if (production && origins.length === 0) errors.push('FRONTEND_URL is required in production');
  if (production && origins.some((origin) => !origin.startsWith('https://') || /localhost|127\.0\.0\.1/i.test(origin))) errors.push('Production FRONTEND_URL entries must be public HTTPS origins');
  if (production && environment.GOOGLE_CLIENT_ID && !environment.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) errors.push('GOOGLE_CLIENT_ID must be a Google web client ID');
  const requiredKeys=['SESSION_HASH_KEY','CSRF_SIGNING_KEY','OTP_HASH_KEY','AUTH_THROTTLE_KEY','MFA_RECOVERY_KEY'];
  for(const name of requiredKeys)if(production&&(String(environment[name]||'').length<32||looksPlaceholder(environment[name])))errors.push(`${name} must contain at least 32 non-placeholder characters`);
  if(production){try{if(Buffer.from(environment.MFA_ENCRYPTION_KEY||'','base64').length!==32)errors.push('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key')}catch{errors.push('MFA_ENCRYPTION_KEY is invalid')}}
  if(production&&(String(environment.CERTIFICATE_SIGNING_KEY||'').length<32||looksPlaceholder(environment.CERTIFICATE_SIGNING_KEY)))errors.push('CERTIFICATE_SIGNING_KEY must contain at least 32 non-placeholder characters');
  if(production&&['disable','no-verify',''].includes(String(environment.DB_SSL||'').toLowerCase()))errors.push('DB_SSL must enable verified TLS in production');
  if(production){const names=['JWT_SECRET',...requiredKeys,'CERTIFICATE_SIGNING_KEY'];const values=names.map((name)=>environment[name]).filter(Boolean);if(new Set(values).size!==values.length)errors.push('Security keys must be independent and may not be reused');}
  if (errors.length) throw new Error(`Secure configuration validation failed: ${errors.join('; ')}`);
  return { production, deploymentEnvironment, origins };
};

const allowedOriginsFor = (environment = process.env) => {
  const configured = parseOrigins(environment.FRONTEND_URL);
  const origins = environment.NODE_ENV === 'production' ? configured : [...configured, ...LOCAL_ORIGINS];
  return [...new Set(origins)];
};

const enforceHttps = (environment = process.env) => (req, res, next) => {
  if (environment.NODE_ENV !== 'production' || req.secure || req.protocol === 'https') return next();

  const configuredOrigin = parseOrigins(environment.FRONTEND_URL)[0];
  const requestHost = req.get('host');
  const safeHost = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(requestHost || '') ? requestHost : null;
  const fallbackHost = configuredOrigin ? new URL(configuredOrigin).host : null;
  const host = safeHost || fallbackHost;
  if (!host) return res.status(400).json({ success: false, message: 'A secure HTTPS request is required' });

  return res.redirect(308, `https://${host}${req.originalUrl || '/'}`);
};

module.exports = { allowedOriginsFor, CORS_METHODS, enforceHttps, parseOrigins, validateSecureConfig };
