const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = (name) => fs.readFileSync(path.join(__dirname, '../../database/migrations', name), 'utf8');

test('administrator enum additions commit before legacy account conversion', () => {
    const addRoles = migration('028_administrator_role_separation.sql');
    const convert = migration('029_convert_legacy_administrators.sql');
    assert.match(addRoles, /SYSTEM_ADMIN/);
    assert.match(addRoles, /DISCIPLINE_ADMIN/);
    assert.doesNotMatch(addRoles, /UPDATE users/);
    assert.match(convert, /WHERE role = 'ADMIN'/);
    assert.match(convert, /role = 'DISCIPLINE_ADMIN'/);
    assert.match(convert, /session_version = session_version \+ 1/);
    assert.doesNotMatch(convert, /DELETE|TRUNCATE|DROP TABLE/i);
});

test('role merge converts System Administrators without deleting historical data', () => {
    const merge = migration('037_merge_system_administrator.sql');
    assert.match(merge, /WHERE role = 'SYSTEM_ADMIN'/);
    assert.match(merge, /role = 'DISCIPLINE_ADMIN'/);
    assert.match(merge, /session_version = session_version \+ 1/);
    assert.match(merge, /ADD COLUMN IF NOT EXISTS target_version/);
    assert.match(merge, /support_access_requests[\s\S]*status = 'REVOKED'/);
    assert.doesNotMatch(merge, /DELETE|TRUNCATE|DROP TABLE/i);
});
