const pool = require('../src/config/database');

const checkDatabaseSecurity = async (database = pool) => {
  const schema = (await database.query('SELECT current_schema() AS name')).rows[0]?.name;
  if (!schema) throw new Error('Database connection has no active schema');
  const runtimeIdentity = (await database.query(
    `SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole,
            pg_has_role(current_user,'sti_vio_log_runtime','member') AS runtime_member
     FROM pg_roles r WHERE r.rolname=current_user`
  )).rows[0];
  const tables = (await database.query(
    `SELECT count(1)::int AS total,
            count(1) FILTER (WHERE rowsecurity)::int AS rls
     FROM pg_tables WHERE schemaname=$1`,
    [schema]
  )).rows[0];
  const grants = (await database.query(
    `SELECT count(1)::int AS count
     FROM information_schema.role_table_grants
     WHERE table_schema=$1 AND grantee=ANY($2::text[])`,
    [schema, ['anon', 'authenticated']]
  )).rows[0];
  const functionExposure = (await database.query(
    `SELECT count(1)::int AS count FROM information_schema.routine_privileges
     WHERE specific_schema=$1 AND grantee=ANY($2::text[])`,
    [schema, ['PUBLIC', 'anon', 'authenticated']]
  )).rows[0];
  const unsafeDefiners = (await database.query(
    `SELECT count(1)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname=$1 AND p.prosecdef=TRUE`, [schema]
  )).rows[0];
  const auditMutationGrants = (await database.query(
    `SELECT count(1)::int AS count FROM information_schema.role_table_grants
     WHERE table_schema=$1 AND table_name=ANY($2::text[]) AND grantee='sti_vio_log_runtime'
       AND ((table_name='schema_migrations' AND privilege_type<>'SELECT')
         OR (table_name<>'schema_migrations' AND privilege_type IN ('UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')))`,
    [schema, ['audit_logs', 'administrative_security_events', 'schema_migrations']]
  )).rows[0];
  const result = { runtime_role:runtimeIdentity?.rolname || null, runtime_role_member:Boolean(runtimeIdentity?.runtime_member),
    runtime_privileged:Boolean(runtimeIdentity?.rolsuper || runtimeIdentity?.rolbypassrls || runtimeIdentity?.rolcreatedb || runtimeIdentity?.rolcreaterole),
    public_tables:Number(tables.total), rls_enabled:Number(tables.rls), public_api_grants:Number(grants.count),
    public_function_grants:Number(functionExposure.count), public_security_definers:Number(unsafeDefiners.count),
    audit_mutation_grants:Number(auditMutationGrants.count) };
  result.secure = result.runtime_role_member && !result.runtime_privileged
    && result.public_tables === result.rls_enabled && result.public_api_grants === 0
    && result.public_function_grants === 0 && result.public_security_definers === 0 && result.audit_mutation_grants === 0;
  if (!result.secure) {
    const error = new Error('Database security invariants are not satisfied');
    error.code = 'DATABASE_SECURITY_CHECK_FAILED';
    error.details = result;
    throw error;
  }
  return result;
};

if (require.main === module) checkDatabaseSecurity()
  .then((result) => { console.log(JSON.stringify(result)); })
  .catch((error) => { console.error(`Database security check failed: ${error.code || error.message}`); process.exitCode = 1; })
  .finally(() => pool.end());

module.exports = { checkDatabaseSecurity };
