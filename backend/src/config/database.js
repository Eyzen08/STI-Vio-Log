const { Pool } = require("pg");
require("dotenv").config();

const dbSchema = process.env.DB_SCHEMA;
const sslMode = (process.env.DB_SSL || "disable").toLowerCase();
if(process.env.NODE_ENV==='production'&&sslMode==='no-verify')throw new Error('DB_SSL=no-verify is forbidden in production');

if (dbSchema && !/^sti_vio_log_test_[a-z0-9_]+$/.test(dbSchema)) {
    throw new Error("DB_SCHEMA must be a guarded STI Vio-Log test schema name");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: dbSchema ? `-c search_path=${dbSchema}` : undefined,
    // Vercel instances each own a pool. Supabase transaction pooling therefore
    // needs a single application-side connection per warm function instance.
    max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 1 : 10)),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    statement_timeout:Number(process.env.DB_STATEMENT_TIMEOUT_MS||15000),
    application_name:'sti-vio-log-api',
    allowExitOnIdle:Boolean(process.env.VERCEL),
    ssl: sslMode === "disable" ? false : {
        rejectUnauthorized: sslMode !== "no-verify"
    }
});

module.exports = pool;
