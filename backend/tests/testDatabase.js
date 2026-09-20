const { URL } = require('node:url');

const normalized = (value) => String(value || '').trim().replace(/\/$/, '');

const testDatabaseConfig = (schema) => {
  const connectionString = normalized(process.env.TEST_DATABASE_URL);
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');

  for (const [name, value] of [['DATABASE_URL', process.env.DATABASE_URL], ['MIGRATION_DATABASE_URL', process.env.MIGRATION_DATABASE_URL]]) {
    if (value && normalized(value) === connectionString) throw new Error(`TEST_DATABASE_URL must not match ${name}`);
  }

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol');

  const runtimeDatabase = String(process.env.DB_NAME || '').trim();
  const runtimeHost = String(process.env.DB_HOST || '').trim().toLowerCase();
  const runtimePort = String(process.env.DB_PORT || '5432').trim();
  const runtimeUser = String(process.env.DB_USER || '').trim();
  const sameLegacyRuntime = runtimeDatabase
    && decodeURIComponent(parsed.pathname.slice(1)) === runtimeDatabase
    && (!runtimeHost || parsed.hostname.toLowerCase() === runtimeHost)
    && (!runtimePort || (parsed.port || '5432') === runtimePort)
    && (!runtimeUser || decodeURIComponent(parsed.username) === runtimeUser);
  if (sameLegacyRuntime) throw new Error('TEST_DATABASE_URL must not point to the normal runtime database');

  return { connectionString, ...(schema ? { options: `-c search_path=${schema}` } : {}) };
};

module.exports = { testDatabaseConfig };
