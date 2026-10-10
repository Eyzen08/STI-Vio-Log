const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { testDatabaseConfig } = require('./testDatabase');
const { runMigrations } = require('../scripts/migrate');
const { createLegalPolicyService } = require('../src/services/legalPolicyService');
const { legalPolicyManifest, publishedPolicies } = require('../../shared/legalPolicies.mjs');

test('real PostgreSQL preserves concurrent acknowledgments and enforces append-only runtime access', async () => {
    const schema = `sti_vio_log_test_legal_${process.pid}_${Date.now()}`;
    const owner = new Pool(testDatabaseConfig());
    const pool = new Pool(testDatabaseConfig(schema));
    let runtime;
    try {
        await owner.query(`CREATE SCHEMA ${schema}`);
        await runMigrations(pool, { logger: { log() {} } });
        const userId = (await pool.query("INSERT INTO users(username,password_hash,role) VALUES('legal_fixture','hash','STUDENT') RETURNING id")).rows[0].id;
        runtime = await pool.connect();
        await runtime.query('SET ROLE sti_vio_log_runtime');
        const service = createLegalPolicyService({ database: runtime, manifest: { ...legalPolicyManifest, enforcementEnabled: true } });
        const versions = { acknowledgment_version: legalPolicyManifest.acknowledgmentVersion, terms_version: publishedPolicies.terms.version, privacy_notice_version: publishedPolicies.privacy.version };
        const concurrent = createLegalPolicyService({ database: pool, manifest: { ...legalPolicyManifest, enforcementEnabled: true } });
        const results = await Promise.all([service.acknowledge(userId, versions), concurrent.acknowledge(userId, versions)]);
        assert.equal(results[0].acknowledged_at, results[1].acknowledged_at);
        assert.equal((await service.status(userId)).required, false);
        assert.equal((await service.acknowledge(userId, versions)).acknowledged_at, results[0].acknowledged_at);
        assert.equal((await pool.query('SELECT COUNT(*)::int count FROM terms_acknowledgments')).rows[0].count, 1);
        for (const statement of ['UPDATE terms_acknowledgments SET acknowledged_at=CURRENT_TIMESTAMP', 'DELETE FROM terms_acknowledgments', 'TRUNCATE terms_acknowledgments']) {
            await assert.rejects(runtime.query(statement), { code: '42501' });
        }
        await assert.rejects(pool.query('DELETE FROM users WHERE id=$1', [userId]), error => error.constraint === 'terms_acknowledgments_user_id_fkey' && ['23503', '23001'].includes(error.code));
        assert.equal((await pool.query("SELECT rowsecurity FROM pg_tables WHERE schemaname=$1 AND tablename='terms_acknowledgments'", [schema])).rows[0].rowsecurity, true);
        const publicGrants = await pool.query("SELECT * FROM information_schema.role_table_grants WHERE table_schema=$1 AND table_name='terms_acknowledgments' AND grantee IN ('PUBLIC','anon','authenticated')", [schema]);
        assert.equal(publicGrants.rows.length, 0);
    } finally {
        if (runtime) { await runtime.query('RESET ROLE'); runtime.release(); }
        await pool.end();
        await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await owner.end();
    }
});
