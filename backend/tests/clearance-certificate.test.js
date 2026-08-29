const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'certificate-test-secret-with-enough-length';
const { certificateCode, clearanceIdFromCode } = require('../src/services/clearanceCertificateService');

test('clearance certificate codes are signed and tamper evident', () => {
  const code = certificateCode(42);
  assert.match(code, /^CLR-42-/);
  assert.equal(clearanceIdFromCode(code), 42);
  assert.equal(clearanceIdFromCode(code.replace('CLR-42-', 'CLR-43-')), null);
  assert.equal(clearanceIdFromCode('CLR-42-invalid'), null);
});

test('certificate routes separate owned issuance from public verification', () => {
  const studentRouter = require('../src/routes/studentClearanceRoutes');
  const publicRouter = require('../src/routes/certificateRoutes');
  const studentPaths = studentRouter.stack.map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  const publicPaths = publicRouter.stack.map((layer) => `${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
  assert.ok(studentPaths.includes('get /certificate'));
  assert.ok(publicPaths.includes('get /clearance/:code'));
});
