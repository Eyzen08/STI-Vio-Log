const { OAuth2Client } = require('google-auth-library');

class GoogleIdentityVerificationError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'GoogleIdentityVerificationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const configuredClientId = (env = process.env) => {
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId || clientId.includes('<') || clientId.startsWith('replace-')) {
    throw new GoogleIdentityVerificationError('Google authentication is not configured', 503, 'GOOGLE_AUTH_UNAVAILABLE');
  }
  return clientId;
};

const createGoogleIdentityVerifier = ({ clientId = configuredClientId(), client } = {}) => {
  const verifierClient = client || new OAuth2Client(clientId);

  return async (credential) => {
    const idToken = typeof credential === 'string' ? credential.trim() : '';
    if (!idToken || idToken.length > 20000) {
      throw new GoogleIdentityVerificationError('Invalid Google credential', 401, 'GOOGLE_TOKEN_INVALID');
    }

    try {
      const ticket = await verifierClient.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket && ticket.getPayload();
      const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
      if (!subject || subject.length > 255) throw new Error('Google token subject is missing');

      return Object.freeze({
        subject,
        email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null,
        emailVerified: payload.email_verified === true,
        hostedDomain: typeof payload.hd === 'string' ? payload.hd.trim().toLowerCase() : null
      });
    } catch (error) {
      if (error instanceof GoogleIdentityVerificationError) throw error;
      throw new GoogleIdentityVerificationError('Invalid Google credential', 401, 'GOOGLE_TOKEN_INVALID');
    }
  };
};

module.exports = { configuredClientId, createGoogleIdentityVerifier, GoogleIdentityVerificationError };
