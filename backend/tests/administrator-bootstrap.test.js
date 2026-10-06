const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createAdministratorBootstrapService } = require('../src/services/administratorBootstrapService');

const client = (responses) => ({
  queries: [],
  async query(sql, params) { this.queries.push({ sql, params }); return responses.shift() || { rows: [], rowCount: 0 }; },
  release() {}
});

test('bootstrap creates one forced-change administrator without auditing its credential', async (t) => {
 for (const password of ['Aa1!xxxx','Aa1!xxxxx','UniqueStrong!8A']) await t.test(`${password.length}-character password`, async () => {
  const db = client([
    {}, {}, { rows: [], rowCount: 0 },
    { rows: [{ id: '9', username: 'discipline.owner', role: 'DISCIPLINE_ADMIN' }], rowCount: 1 },
    {}, {}, {}
  ]);
  const hashed = [];
  const service = createAdministratorBootstrapService({ pool: { connect: async () => db }, hashPassword: async (value) => { hashed.push(value); return 'safe-hash'; } });
  const result = await service.bootstrap({ role: 'DISCIPLINE_ADMIN', username: 'discipline.owner', password, firstName: 'Main', lastName: 'Owner' });
  assert.equal(result.generatedPassword, null);
  assert.match(db.queries[3].sql, /must_change_password/);
  assert.deepEqual(hashed, [password]);
  assert.equal(db.queries.flatMap((query) => query.params || []).includes(password), false);
  assert.equal(JSON.stringify(db.queries).includes(password), false);
 });
});

test('bootstrap rejects a 7-character password before hashing or database access', async () => {
  const service = createAdministratorBootstrapService({pool:{connect:async()=>assert.fail('Short password must not reach the database')},hashPassword:async()=>assert.fail('Short password must not be hashed')});
  await assert.rejects(service.bootstrap({role:'DISCIPLINE_ADMIN',username:'discipline.owner',password:'Aa1!xxx',firstName:'Main',lastName:'Owner'}), /administrator password policy/);
});

test('bootstrap refuses an existing administrator role under a transaction lock', async () => {
  const db = client([{}, {}, { rows: [{ id: 1 }], rowCount: 1 }, {}]);
  const service = createAdministratorBootstrapService({ pool: { connect: async () => db }, hashPassword: async () => 'hash' });
  await assert.rejects(() => service.bootstrap({ role: 'DISCIPLINE_ADMIN', username: 'discipline.owner', password: 'UniqueStrong!8A', firstName: 'Main', lastName: 'Officer' }), /already exists/);
  assert.match(db.queries[1].sql, /pg_advisory_xact_lock/);
  assert.equal(db.queries.at(-1).sql, 'ROLLBACK');
});

test('bootstrap command is disabled by default and does not contain credentials', () => {
  const source = fs.readFileSync(require.resolve('../scripts/bootstrap-administrator'), 'utf8');
  assert.match(source, /ADMIN_BOOTSTRAP_ENABLED/);
  assert.doesNotMatch(source, /password\s*[:=]\s*['\"][^'\"]+['\"]/i);
});
