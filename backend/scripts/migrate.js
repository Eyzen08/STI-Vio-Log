const fs = require("node:fs");
const path = require("node:path");

const migrationsDirectory = path.resolve(__dirname, "../../database/migrations");

const listMigrationFiles = (directory = migrationsDirectory) =>
    fs.readdirSync(directory)
        .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
        .sort((a, b) => a.localeCompare(b));

const ensureTrackingTable = (executor) => executor.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

const migrationStatus = async (executor, directory = migrationsDirectory) => {
    await ensureTrackingTable(executor);
    const applied = new Set((await executor.query("SELECT migration_name FROM schema_migrations ORDER BY migration_name")).rows.map((row) => row.migration_name));
    return listMigrationFiles(directory).map((name) => ({ name, applied: applied.has(name) }));
};

const runMigrations = async (pool, { directory = migrationsDirectory, logger = console } = {}) => {
    const client = await pool.connect();
    try {
        await client.query("SELECT pg_advisory_lock(hashtext('sti_vio_log_schema_migrations'))");
        await ensureTrackingTable(client);
        const status = await migrationStatus(client, directory);
        const applied = [];
        for (const migration of status.filter((item) => !item.applied)) {
            logger.log(`Applying ${migration.name}`);
            await client.query("BEGIN");
            try {
                await client.query(fs.readFileSync(path.join(directory, migration.name), "utf8"));
                await client.query("INSERT INTO schema_migrations (migration_name) VALUES ($1)", [migration.name]);
                await client.query("COMMIT");
                applied.push(migration.name);
            } catch (error) {
                await client.query("ROLLBACK");
                throw new Error(`Migration ${migration.name} failed: ${error.message}`, { cause: error });
            }
        }
        return { applied, status: await migrationStatus(client, directory) };
    } finally {
        try { await client.query("SELECT pg_advisory_unlock(hashtext('sti_vio_log_schema_migrations'))"); } catch (_) {}
        client.release();
    }
};

const main = async () => {
    const pool = require("../src/config/database");
    try {
        if (process.argv[2] === "status") {
            for (const item of await migrationStatus(pool)) console.log(`${item.applied ? "applied" : "pending"}  ${item.name}`);
        } else {
            const result = await runMigrations(pool);
            console.log(result.applied.length ? `Applied ${result.applied.length} migration(s).` : "Database is already up to date.");
        }
    } finally { await pool.end(); }
};

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { listMigrationFiles, migrationStatus, runMigrations };
