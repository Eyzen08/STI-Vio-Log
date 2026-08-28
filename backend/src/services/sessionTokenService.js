const jwt = require('jsonwebtoken');

const getJwtSecret = (env = process.env) => {
  const secret = env.JWT_SECRET;
  const insecure = ['sti-vio-log-dev-secret-change-me', 'change-this-to-a-long-random-secret'];
  if (!secret || insecure.includes(secret) || secret.length < 32) {
    const error = new Error('JWT_SECRET is not configured securely. Set a strong environment secret before launch.');
    error.statusCode = 500;
    throw error;
  }
  return secret;
};

const issueSessionToken = (user, { env = process.env, expiresIn = '8h' } = {}) => jwt.sign(
  {
    id: Number(user.id), username: user.username, role: user.role,
    session_version: Number(user.session_version || 1),
    password_change_required: Boolean(user.must_change_password)
  },
  getJwtSecret(env),
  { expiresIn }
);

module.exports = { getJwtSecret, issueSessionToken };
