const test = require('node:test');
const assert = require('node:assert/strict');
const { testDatabaseConfig } = require('./testDatabase');

const withEnvironment = (values, action) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) value === undefined ? delete process.env[key] : process.env[key] = value;
  try { return action(); }
  finally {
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
};

test('PostgreSQL integration configuration requires a dedicated test URL', () => {
  withEnvironment({ TEST_DATABASE_URL: undefined }, () => assert.throws(() => testDatabaseConfig(), /TEST_DATABASE_URL is required/));
  withEnvironment({ TEST_DATABASE_URL: 'postgres://test@db.example/sti_test', DATABASE_URL: 'postgres://test@db.example/sti_test' },
    () => assert.throws(() => testDatabaseConfig(), /must not match DATABASE_URL/));
  withEnvironment({ TEST_DATABASE_URL: 'postgres://test@db.example/sti_test', DATABASE_URL: undefined, MIGRATION_DATABASE_URL: undefined, DB_NAME: 'sti_runtime', DB_HOST: 'db.example', DB_USER: 'test' }, () => {
    assert.equal(testDatabaseConfig('safe_schema').options, '-c search_path=safe_schema');
  });
});
