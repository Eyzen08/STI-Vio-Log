import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('administrator settings reuse secure password controls and email verification',()=>{const source=fs.readFileSync(new URL('../src/components/AdminAccountSettings.jsx',import.meta.url),'utf8');assert.match(source,/PasswordField/);assert.match(source,/PasswordRequirements/);assert.match(source,/currentPassword:password\.current/);assert.match(source,/admin-profile\/email\/verify/);assert.match(source,/email_verified/);assert.doesNotMatch(source,/JSON\.stringify\([^)]*role/)})
