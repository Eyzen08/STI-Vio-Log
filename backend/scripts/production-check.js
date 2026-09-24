require('dotenv').config({ quiet: true });
const pool = require('../src/config/database');
const { validateSecureConfig } = require('../src/config/security');
const { migrationStatus } = require('./migrate');
const { checkDatabaseSecurity } = require('./check-database-security');

const runProductionCheck = async ({ environment = process.env, database = pool } = {}) => {
  const configuration = validateSecureConfig(environment);
  if (!configuration.production) throw new Error('NODE_ENV must be production for a production readiness check');
  await database.query('SELECT 1 AS healthy');
  const runtimeRole = (await database.query(`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,
    pg_has_role(current_user,'sti_vio_log_runtime','member') AS runtime_member,
    EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) AS owns_app_tables
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if (!runtimeRole || !runtimeRole.runtime_member || runtimeRole.rolsuper || runtimeRole.rolcreatedb || runtimeRole.rolcreaterole || runtimeRole.rolbypassrls || runtimeRole.owns_app_tables) {
    throw new Error('DATABASE_URL must use a non-owner login that inherits sti_vio_log_runtime without elevated privileges');
  }
  const migrations = await migrationStatus(database, undefined, { ensure: false });
  const pending = migrations.filter((migration) => !migration.applied).map((migration) => migration.name);
  if (pending.length) throw new Error(`Pending database migrations: ${pending.join(', ')}`);
  const security = await checkDatabaseSecurity(database);
  return { database: 'connected', migrations: 'current', migration_count: migrations.length, database_security:'passed', security };
};

if (require.main === module) runProductionCheck()
  .then((result) => console.log(`Production readiness passed: database ${result.database}; ${result.migration_count} migrations ${result.migrations}.`))
  .catch((error) => { console.error(`Production readiness failed: ${error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());

module.exports = { runProductionCheck };
