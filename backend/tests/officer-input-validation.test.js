const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccountAdministrationService } = require('../src/services/accountAdministrationService');
const { createDepartmentAdministrationService } = require('../src/services/departmentAdministrationService');

const identity = { actorId: 1, targetId: 2, departmentId: 3, departmentName: 'Research & Development', firstName: 'José', lastName: 'O’Connor-Santos', username: 'office.head_1', role: 'DEPARTMENT_HEAD', employeeNumber: 'EMP-123', email: 'office@example.com', reason: 'Correct officer details' };

test('all officer creation and profile paths reject invalid identity before database work', async () => {
  const service = createAccountAdministrationService({ pool: { async connect() { throw new Error('Invalid input reached database'); } } });
  for (const method of ['createDepartmentOfficer', 'create', 'updateProfile']) {
    for (const [field, value] of [['firstName', 'Ana123'], ['lastName', 'Cruz#'], ['firstName', '---'], ['firstName', 'Ana--Maria'], ['username', 'office head'], ['username', '.head'], ['employeeNumber', 'EMP---123'], ['employeeNumber', 'EMP#123'], ['email', 'invalid'], ['firstName', 'A'.repeat(101)], ['username', 'a'.repeat(101)], ['employeeNumber', '1'.repeat(51)], ['email', 'a'.repeat(250) + '@x.test']]) {
      await assert.rejects(service[method]({ ...identity, [field]: value }), error => error.statusCode === 400 && error.code === 'VALIDATION_ERROR', `${method}: ${field}`);
    }
  }
  for (const departmentName of ['Library2', 'Office$$;;', '---', 'A'.repeat(151)]) await assert.rejects(service.createDepartmentOfficer({ ...identity, departmentName }), error => error.code === 'VALIDATION_ERROR');
});

test('department creation and editing cannot bypass the department name restrictions', async () => {
  const service = createDepartmentAdministrationService({ pool: { async connect() { throw new Error('Invalid input reached database'); } } });
  for (const name of ['Library2', 'Office$$;;', '---', 'A'.repeat(151)]) {
    await assert.rejects(service.create({ actorId: 1, code: 'LIBRARY', name }), error => error.code === 'VALIDATION_ERROR');
    await assert.rejects(service.update({ actorId: 1, departmentId: 3, name, reason: 'Correct name' }), error => error.code === 'VALIDATION_ERROR');
  }
});

test('valid accented names, initials and employee IDs still create linked officers', async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('INSERT INTO departments')) return { rows: [{ id: 3, department_name: params[1], department_code: params[0], department_type: params[2], is_active: true }] };
    if (sql.startsWith('INSERT INTO users')) return { rows: [{ id: 2, username: params[0], role: params[2], is_active: true }] };
    return { rows: [] };
  }, release() {} };
  const service = createAccountAdministrationService({ pool: { connect: async () => client }, hashPassword: async () => 'hashed', randomBytes: () => Buffer.alloc(18, 1) });
  for (const role of ['DEPARTMENT_HEAD', 'DISCIPLINE_OFFICE']) {
    const result = await service.createDepartmentOfficer({ ...identity, role });
    assert.equal(result.account.first_name, 'José');
    assert.equal(result.account.employee_number, 'EMP-123');
    assert.equal(result.department.department_name, 'Research & Development');
    assert.ok(result.temporary_password);
  }
  const result = await service.createDepartmentOfficer({ ...identity, firstName: 'J. P.', employeeNumber: '', email: '' });
  assert.equal(result.account.first_name, 'J. P.');
  assert.equal(result.account.employee_number, null);
  assert.equal(calls.filter(call => call.sql === 'COMMIT').length, 3);
});
