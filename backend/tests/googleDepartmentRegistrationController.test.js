const test = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleDepartmentRegistrationController } = require('../src/controllers/googleDepartmentRegistrationController');

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('department rejection refuses a client-supplied department assignment', async () => {
  let reviewed = false;
  const controller = createGoogleDepartmentRegistrationController({ service: { async review() { reviewed = true; } } });
  const res = response();
  await controller.reject({ params: { id: '7' }, user: { id: 1 }, body: { reason: 'Rejected', department_id: 8 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal(reviewed, false);
});
