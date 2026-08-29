const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../src/routes/googleRegistrationRoutes');
const { createGoogleRegistrationController } = require('../src/controllers/googleRegistrationController');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('registration review routes expose list, approval, and rejection only', () => {
  const routes = router.stack.filter((layer) => layer.route).map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  assert.deepEqual(routes, [
    { path: '/', methods: ['get'] },
    { path: '/:id/approve', methods: ['post'] },
    { path: '/:id/reject', methods: ['post'] }
  ]);
});

test('review controller derives reviewer identity from authentication', async () => {
  let reviewInput;
  const controller = createGoogleRegistrationController({ service: { async review(value) { reviewInput = value; return { id: 7, status: 'APPROVED' }; } } });
  const res = response();
  await controller.approve({ params: { id: '7' }, user: { id: 91 }, body: { reason: 'Verified enrollment', academic_year: '2026-2027', semester: 'First Semester', verification_method: 'SIS', verification_reference: 'SIS-42' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(reviewInput, { registrationId: '7', reviewerId: 91, decision: 'APPROVED', reason: 'Verified enrollment', academicYear: '2026-2027', semester: 'First Semester', verificationMethod: 'SIS', verificationReference: 'SIS-42' });
});

test('review controller rejects actor and status overrides', async () => {
  const controller = createGoogleRegistrationController({ service: { async review() { throw new Error('must not run'); } } });
  const res = response();
  await controller.reject({ params: { id: '7' }, user: { id: 91 }, body: { reason: 'No enrollment', reviewed_by: 1 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});
