const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'certificate-test-secret-with-enough-length';
const { certificateCode, clearanceIdFromCode, hoursInWords, parseSignatureImage, renderCertificatePdf } = require('../src/services/clearanceCertificateService');

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
  assert.ok(studentPaths.includes('get /certificates'));
  assert.ok(studentPaths.includes('get /certificates/:id/pdf'));
  assert.ok(publicPaths.includes('get /clearance/:code'));
});

test('certificate hours are rendered in words and signature uploads are bounded images', () => {
  assert.equal(hoursInWords(48), 'forty-eight');
  assert.equal(hoursInWords(2.5), 'two hours and thirty minutes');
  const parsed = parseSignatureImage(`data:image/png;base64,${Buffer.from('png').toString('base64')}`);
  assert.equal(parsed.mimeType, 'image/png');
  assert.deepEqual(parsed.buffer, Buffer.from('png'));
  assert.throws(() => parseSignatureImage('data:text/plain;base64,dGVzdA=='), /PNG or JPEG/);
});

test('certificate PDF is printable and contains a single PDF document', async () => {
  const pdf = await renderCertificatePdf({ certificateNumber: 'TEST-001', studentName: 'A Very Long Student Name Dela Cruz', program: 'Bachelor of Science in Information Technology', completedHours: 48, issueDate: '2026-09-03', signatures: [] });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1000);
});
