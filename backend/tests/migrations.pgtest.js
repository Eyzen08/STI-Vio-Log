const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Pool } = require("pg");
const { runMigrations, migrationStatus } = require("../scripts/migrate");

require("dotenv").config({ quiet: true });

const suffix = `${process.pid}_${Date.now()}`.toLowerCase();
const freshSchema = `sti_vio_log_test_fresh_${suffix}`;
const upgradeSchema = `sti_vio_log_test_upgrade_${suffix}`;
const migrationsDir = path.resolve(__dirname, "../../database/migrations");
const adminPool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const schemaPool = (schema) => new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: `-c search_path=${schema}` });

test.before(async () => {
    for (const schema of [freshSchema, upgradeSchema]) {
        if (!/^sti_vio_log_test_[a-z0-9_]+$/.test(schema)) throw new Error("Unsafe migration test schema");
        await adminPool.query(`CREATE SCHEMA ${schema}`);
    }
});

test.after(async () => {
    for (const schema of [freshSchema, upgradeSchema]) await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
});

test("fresh migration chain is complete and idempotent", async () => {
    const pool = schemaPool(freshSchema);
    try {
        const first = await runMigrations(pool, { logger: { log() {} } });
        assert.deepEqual(first.applied, ["001_initial_schema.sql", "002_violation_lifecycle.sql", "003_service_clearance_sync.sql", "004_community_service_sessions.sql"]);
        const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`, [freshSchema])).rows.map((row) => row.table_name);
        for (const name of ["users", "students", "violations", "violation_actions", "community_service_assignments", "community_service_sessions", "community_service_progress_history", "student_clearance", "audit_logs", "schema_migrations"]) assert.ok(tables.includes(name), `missing ${name}`);
        assert.deepEqual((await runMigrations(pool, { logger: { log() {} } })).applied, []);
        assert.ok((await migrationStatus(pool)).every((item) => item.applied));
    } finally { await pool.end(); }
});

test("production-shaped legacy upgrade preserves events and canonicalizes statuses", async () => {
    const pool = schemaPool(upgradeSchema);
    try {
        await pool.query(fs.readFileSync(path.join(migrationsDir, "001_initial_schema.sql"), "utf8"));
        await pool.query(`CREATE TABLE schema_migrations (migration_name varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`INSERT INTO schema_migrations (migration_name) VALUES ('001_initial_schema.sql')`);
        const passwordHash = "$2b$04$abcdefghijklmnopqrstuuXJfM5Z0nJf4wPMFnYbPxM3Ya7kXyQYO";
        await pool.query(`INSERT INTO users (username, password_hash, role) VALUES ('legacy_admin', $1, 'ADMIN'), ('legacy_student', $1, 'STUDENT')`, [passwordHash]);
        await pool.query(`INSERT INTO departments (department_code, department_name) VALUES ('LEG', 'Legacy Department')`);
        await pool.query(`INSERT INTO students (user_id, student_number, first_name, last_name, qr_code)
            SELECT id, '02000111111', 'Legacy', 'Student', 'LEGACY-QR' FROM users WHERE username = 'legacy_student'`);
        await pool.query(`INSERT INTO violations (student_id, violation_type_id, incident_date, reported_by, status, required_service_hours)
            SELECT s.id, 1, CURRENT_DATE, u.id, 'COMPLETED', 1 FROM students s CROSS JOIN users u WHERE u.username = 'legacy_admin'`);
        await pool.query(`INSERT INTO community_service_assignments (violation_id, student_id, required_hours, completed_hours, remaining_hours, status)
            SELECT v.id, v.student_id, 1, 1, 0, 'COMPLETED' FROM violations v`);
        await pool.query(`INSERT INTO community_service_attendance (assignment_id, student_id, department_id, scanned_by, attendance_type)
            SELECT a.id, a.student_id, d.id, u.id, 'TIME_IN' FROM community_service_assignments a CROSS JOIN departments d CROSS JOIN users u WHERE u.username = 'legacy_admin'`);

        assert.deepEqual((await runMigrations(pool, { logger: { log() {} } })).applied, ["002_violation_lifecycle.sql", "003_service_clearance_sync.sql", "004_community_service_sessions.sql"]);
        assert.equal((await pool.query("SELECT status::text FROM violations")).rows[0].status, "COMPLETE");
        assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM community_service_attendance")).rows[0].count, 1);
        assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM community_service_sessions")).rows[0].count, 0);

        const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), "sti-vio-log-migration-"));
        fs.writeFileSync(path.join(brokenDir, "005_controlled_failure.sql"), "CREATE TABLE must_rollback (id int); SELECT missing_column FROM missing_table;");
        await assert.rejects(runMigrations(pool, { directory: brokenDir, logger: { log() {} } }), /005_controlled_failure\.sql failed/);
        assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM schema_migrations WHERE migration_name = '005_controlled_failure.sql'")).rows[0].count, 0);
        assert.equal((await pool.query("SELECT to_regclass('must_rollback') AS table_name")).rows[0].table_name, null);
        fs.rmSync(brokenDir, { recursive: true, force: true });
    } finally { await pool.end(); }
});
