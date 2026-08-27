const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredClientId, createGoogleIdentityVerifier } = require('../src/services/googleIdentityVerifier');

test('Google verifier validates the configured audience and returns minimal claims', async () => {
  let request;
  const verify = createGoogleIdentityVerifier({
    clientId: 'web-client.apps.googleusercontent.com',
    client: {
      async verifyIdToken(options) {
        request = options;
        return { getPayload: () => ({ sub: 'google-sub-123', email: 'Student@Example.COM ', email_verified: true, hd: 'School.EDU' }) };
      }
    }
  });
  const identity = await verify('signed-id-token');
  assert.deepEqual(request, { idToken: 'signed-id-token', audience: 'web-client.apps.googleusercontent.com' });
  assert.deepEqual(identity, { subject: 'google-sub-123', email: 'student@example.com', emailVerified: true, hostedDomain: 'school.edu' });
  assert.equal(Object.isFrozen(identity), true);
});

test('Google verifier rejects missing, malformed, and unverifiable credentials generically', async () => {
  const credential = 'sensitive-token-value';
  const verify = createGoogleIdentityVerifier({
    clientId: 'web-client.apps.googleusercontent.com',
    client: { async verifyIdToken() { throw new Error(`bad token ${credential}`); } }
  });
  for (const input of ['', null, credential]) {
    await assert.rejects(verify(input), (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, 'GOOGLE_TOKEN_INVALID');
      assert.equal(error.message, 'Invalid Google credential');
      assert.equal(error.message.includes(credential), false);
      return true;
    });
  }
});

test('Google verifier rejects tokens without a stable subject', async () => {
  const verify = createGoogleIdentityVerifier({ clientId: 'web-client.apps.googleusercontent.com', client: { async verifyIdToken() { return { getPayload: () => ({ email: 'student@example.com' }) }; } } });
  await assert.rejects(verify('signed-token'), (error) => error.code === 'GOOGLE_TOKEN_INVALID');
});

test('Google verifier fails closed when configuration is absent or placeholder-only', () => {
  for (const GOOGLE_CLIENT_ID of ['', 'replace-with-google-client-id', '<google-client-id>.apps.googleusercontent.com']) {
    assert.throws(() => configuredClientId({ GOOGLE_CLIENT_ID }), (error) => error.statusCode === 503 && error.code === 'GOOGLE_AUTH_UNAVAILABLE');
  }
  assert.equal(configuredClientId({ GOOGLE_CLIENT_ID: ' valid.apps.googleusercontent.com ' }), 'valid.apps.googleusercontent.com');
});
