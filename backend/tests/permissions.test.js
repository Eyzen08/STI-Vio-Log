const test = require('node:test');
const assert = require('node:assert/strict');
const { PERMISSIONS, permissionsForRole, roleHasPermission } = require('../src/security/permissions');
const { authorizePermissions } = require('../src/middleware/authMiddleware');

test('system administrators receive technical permissions but no operational authority', () => {
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.SYSTEM_HEALTH_VIEW), true);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.ACCOUNT_RECOVERY_INITIATE), true);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.VIOLATION_UPDATE), false);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.ATTENDANCE_SCAN), false);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.CLEARANCE_APPROVE), false);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.ESIGNATURE_MANAGE), false);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.GUARDIAN_CONTACT_VIEW), false);
    assert.equal(roleHasPermission('SYSTEM_ADMIN', PERMISSIONS.PRIVATE_MESSAGES_VIEW), false);
});

test('discipline administrators receive operational permissions but no technical authority', () => {
    assert.equal(roleHasPermission('DISCIPLINE_ADMIN', PERMISSIONS.VIOLATION_UPDATE), true);
    assert.equal(roleHasPermission('DISCIPLINE_ADMIN', PERMISSIONS.CLEARANCE_APPROVE), true);
    assert.equal(roleHasPermission('DISCIPLINE_ADMIN', PERMISSIONS.STAFF_ACCOUNT_MANAGE), true);
    assert.equal(roleHasPermission('DISCIPLINE_ADMIN', PERMISSIONS.SYSTEM_CONFIG_SAFE_MANAGE), false);
    assert.equal(roleHasPermission('DISCIPLINE_ADMIN', PERMISSIONS.MAINTENANCE_TOOLS_USE), false);
});

test('unknown and legacy administrator roles default to no permissions', () => {
    assert.deepEqual([...permissionsForRole('ADMIN')], []);
    assert.deepEqual([...permissionsForRole('UNKNOWN')], []);
});

test('permission middleware returns 401, 403, and allows an exact grant', () => {
    const middleware = authorizePermissions(PERMISSIONS.SYSTEM_HEALTH_VIEW);
    let status;
    let body;
    const response = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    middleware({}, response, () => assert.fail('unauthenticated request advanced'));
    assert.equal(status, 401);
    middleware({ user: { role: 'DISCIPLINE_ADMIN' } }, response, () => assert.fail('unauthorized request advanced'));
    assert.equal(status, 403);
    assert.equal(body.error.code, 'FORBIDDEN');
    let advanced = false;
    middleware({ user: { role: 'SYSTEM_ADMIN' } }, response, () => { advanced = true; });
    assert.equal(advanced, true);
});
