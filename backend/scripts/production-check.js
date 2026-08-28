require('dotenv').config({ quiet: true });
const pool = require('../src/config/database');
const { validateSecureConfig } = require('../src/config/security');
const { migrationStatus } = require('./migrate');

const runProductionCheck = async ({ environment = process.env, database = pool } = {}) => {
  const configuration = validateSecureConfig(environment);
  if (!configuration.production) throw new Error('NODE_ENV must be production for a production readiness check');
  await database.query('SELECT 1 AS healthy');
  const migrations = await migrationStatus(database);
  const pending = migrations.filter((migration) => !migration.applied).map((migration) => migration.name);
  if (pending.length) throw new Error(`Pending database migrations: ${pending.join(', ')}`);
  return { database: 'connected', migrations: 'current', migration_count: migrations.length };
};

if (require.main === module) runProductionCheck()
  .then((result) => console.log(`Production readiness passed: database ${result.database}; ${result.migration_count} migrations ${result.migrations}.`))
  .catch((error) => { console.error(`Production readiness failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());

module.exports = { runProductionCheck };
