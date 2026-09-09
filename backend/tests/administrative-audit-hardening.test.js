const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { sanitizeDetails, recordSecurityEvent } = require('../src/services/securityEventService');

test('security-event details recursively redact credentials and tokens', () => {
  const safe=sanitizeDetails({username:'admin.one',password:'NeverLog!8',nested:{jwt_token:'abc',reason:'review'}});
  assert.equal(safe.username,'admin.one');
  assert.equal(safe.password,'[REDACTED]');
  assert.equal(safe.nested.jwt_token,'[REDACTED]');
  assert.equal(JSON.stringify(safe).includes('NeverLog!8'),false);
});

test('structured security events omit secret values', async () => {
  let captured;
  const database={query:async(sql,params)=>{captured={sql,params};return{rows:[]};}};
  const stored=await recordSecurityEvent({database,actor:{id:4,username:'owner',role:'SYSTEM_ADMIN',permissions:['SYSTEM_HEALTH_VIEW']},action:'AUTHORIZATION_DENIED',details:{password:'Hidden!8'},result:'DENIED'});
  assert.equal(stored,true);
  assert.match(captured.sql,/administrative_security_events/);
  assert.equal(JSON.stringify(captured.params).includes('Hidden!8'),false);
});

test('audit migration rejects update and delete operations for both audit stores', () => {
  const source=fs.readFileSync(require.resolve('../../database/migrations/031_administrative_audit_hardening.sql'),'utf8');
  assert.match(source,/BEFORE UPDATE OR DELETE ON audit_logs/);
  assert.match(source,/BEFORE UPDATE OR DELETE ON administrative_security_events/);
  assert.match(source,/request_id UUID/);
  assert.match(source,/result IN \('SUCCESS','DENIED','FAILED'\)/);
});
