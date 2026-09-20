const test = require('node:test');
const assert = require('node:assert/strict');
const { PERMISSIONS, permissionsForRole, roleHasPermission } = require('../src/security/permissions');
const { authorizePermissions } = require('../src/middleware/authMiddleware');

test('discipline administrators receive combined operational and technical authority', () => {
  for (const permission of [PERMISSIONS.VIOLATION_UPDATE,PERMISSIONS.CLEARANCE_APPROVE,PERMISSIONS.STAFF_ACCOUNT_MANAGE,PERMISSIONS.SYSTEM_HEALTH_VIEW,PERMISSIONS.SECURITY_EVENTS_VIEW,PERMISSIONS.ACCOUNT_RECOVERY_INITIATE,PERMISSIONS.MAINTENANCE_TOOLS_USE]) assert.equal(roleHasPermission('DISCIPLINE_ADMIN', permission), true);
});

test('retired and unknown administrator roles have no permissions', () => {
  assert.deepEqual([...permissionsForRole('SYSTEM_ADMIN')], []);
  assert.deepEqual([...permissionsForRole('ADMIN')], []);
  assert.deepEqual([...permissionsForRole('UNKNOWN')], []);
});

test('discipline officers retain operational duties without administrator permissions', () => {
  assert.equal(roleHasPermission('DISCIPLINE_OFFICE', PERMISSIONS.CLEARANCE_APPROVE), true);
  assert.equal(roleHasPermission('DISCIPLINE_OFFICE', PERMISSIONS.STAFF_ACCOUNT_MANAGE), false);
  assert.equal(roleHasPermission('DISCIPLINE_OFFICE', PERMISSIONS.SYSTEM_HEALTH_VIEW), false);
});

test('department heads can view only department-scoped reports', () => {
  assert.equal(roleHasPermission('DEPARTMENT_HEAD', PERMISSIONS.DEPARTMENT_REPORT_VIEW), true);
  assert.equal(roleHasPermission('DEPARTMENT_HEAD', PERMISSIONS.REPORT_VIEW), false);
  assert.equal(roleHasPermission('DEPARTMENT_HEAD', PERMISSIONS.PRIVATE_MESSAGES_VIEW), false);
});

test('permission middleware allows the unified administrator and denies other roles', () => {
  const middleware=authorizePermissions(PERMISSIONS.SYSTEM_HEALTH_VIEW);let status;const response={status(value){status=value;return this},json(){return this}};
  middleware({},response,()=>assert.fail('unauthenticated request advanced'));assert.equal(status,401);
  middleware({user:{role:'DISCIPLINE_OFFICE'}},response,()=>assert.fail('unauthorized request advanced'));assert.equal(status,403);
  let advanced=false;middleware({user:{role:'DISCIPLINE_ADMIN'}},response,()=>{advanced=true});assert.equal(advanced,true);
});

test('Department Accounts are denied by every messaging permission guard', () => {
  const middleware=authorizePermissions(PERMISSIONS.PRIVATE_MESSAGES_VIEW);let status;
  middleware({user:{role:'DEPARTMENT_HEAD'}},{status(value){status=value;return this},json(){return this}},()=>assert.fail('Department Account advanced into messaging'));
  assert.equal(status,403);assert.equal(roleHasPermission('STUDENT',PERMISSIONS.PRIVATE_MESSAGES_VIEW),true);
});
