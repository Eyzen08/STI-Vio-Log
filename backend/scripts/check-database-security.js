const pool = require('../src/config/database');

const checkDatabaseSecurity = async (database = pool) => {
  const tables = (await database.query(
    `SELECT count(1)::int AS total,
            count(1) FILTER (WHERE rowsecurity)::int AS rls
     FROM pg_tables WHERE schemaname=$1`,
    ['public']
  )).rows[0];
  const grants = (await database.query(
    `SELECT count(1)::int AS count
     FROM information_schema.role_table_grants
     WHERE table_schema=$1 AND grantee=ANY($2::text[])`,
    ['public', ['anon', 'authenticated']]
  )).rows[0];
  return { public_tables: tables.total, rls_enabled: tables.rls, public_api_grants: grants.count };
};

if (require.main === module) checkDatabaseSecurity()
  .then((result) => { console.log(JSON.stringify(result)); })
  .catch((error) => { console.error(`Database security check failed: ${error.code || error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());

module.exports = { checkDatabaseSecurity };
