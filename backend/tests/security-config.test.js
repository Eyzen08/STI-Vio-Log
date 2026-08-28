const test = require('node:test');
const assert = require('node:assert/strict');
const { allowedOriginsFor, CORS_METHODS, validateSecureConfig } = require('../src/config/security');

const secure = { NODE_ENV:'production',JWT_SECRET:'a'.repeat(48),DATABASE_URL:'postgresql://example',FRONTEND_URL:'https://portal.example.test',GOOGLE_CLIENT_ID:'123.apps.googleusercontent.com' };
test('production accepts DATABASE_URL without redundant DB parts',()=>{assert.doesNotThrow(()=>validateSecureConfig(secure))});
test('production rejects localhost, HTTP, missing origins, and placeholder secrets',()=>{assert.throws(()=>validateSecureConfig({...secure,FRONTEND_URL:'http://localhost:5173'}),/HTTPS/);assert.throws(()=>validateSecureConfig({...secure,FRONTEND_URL:''}),/required/);assert.throws(()=>validateSecureConfig({...secure,JWT_SECRET:'change-this-to-a-long-random-secret'}),/JWT_SECRET/)});
test('production CORS excludes local origins while development includes them',()=>{assert.deepEqual(allowedOriginsFor(secure),['https://portal.example.test']);assert.ok(allowedOriginsFor({...secure,NODE_ENV:'development'}).includes('http://localhost:5173'))});
test('CORS supports every application mutation method including PATCH',()=>{assert.ok(CORS_METHODS.includes('PATCH'));assert.ok(CORS_METHODS.includes('POST'));assert.ok(CORS_METHODS.includes('DELETE'))});
