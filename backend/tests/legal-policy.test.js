const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createLegalPolicyService, isLegalExemptRequest } = require('../src/services/legalPolicyService');
const { createLegalPolicyController } = require('../src/controllers/legalPolicyController');
const { legalPolicyManifest, publishedPolicies } = require('../../shared/legalPolicies.mjs');
const { createLegalPolicyMiddleware } = require('../src/middleware/legalPolicyMiddleware');

const manifest = { ...legalPolicyManifest, enforcementEnabled: true };
const versions = {
    acknowledgment_version: manifest.acknowledgmentVersion,
    terms_version: publishedPolicies.terms.version,
    privacy_notice_version: publishedPolicies.privacy.version
};
const hash = (document) => createHash('sha256').update(JSON.stringify(document)).digest('hex');
const storedAt = new Date('2026-10-10T00:00:00Z');
const database = () => {
    const rows = new Map();
    const calls = [];
    return {
        rows, calls,
        async query(sql, values) {
            calls.push({ sql, values });
            const key = `${values[0]}:${values[1]}`;
            if (sql.includes('INSERT INTO')) {
                if (rows.has(key)) return { rows: [] };
                rows.set(key, { acknowledged_at: storedAt });
                return { rows: [rows.get(key)] };
            }
            return { rows: rows.has(key) ? [rows.get(key)] : [] };
        }
    };
};

test('disabled enforcement neither queries acknowledgments nor accepts writes', async () => {
    const db = database();
    const service = createLegalPolicyService({ database: db });
    const status = await service.status(1);
    assert.equal(status.required, false);
    assert.equal(status.enforcement_enabled, false);
    assert.deepEqual(status.documents, publishedPolicies);
    await assert.rejects(service.acknowledge(1, versions), { code: 'LEGAL_ACKNOWLEDGMENT_DISABLED', statusCode: 409 });
    assert.equal(db.calls.length, 0);
});

test('acknowledgment uses server identity, hashes and timestamp and survives repeat login', async () => {
    const db = database();
    const service = createLegalPolicyService({ database: db, manifest });
    assert.equal((await service.status(12)).required, true);
    const status = await service.acknowledge(12, versions);
    assert.equal(status.required, false);
    assert.equal(status.acknowledged_at, storedAt.toISOString());
    const insert = db.calls.find(call => call.sql.includes('INSERT INTO'));
    assert.deepEqual(insert.values, [12, versions.acknowledgment_version, versions.terms_version, versions.privacy_notice_version, hash(publishedPolicies.terms), hash(publishedPolicies.privacy)]);
    assert.equal((await service.status(12)).required, false);
    assert.equal((await service.status(13)).required, true);
});

test('concurrent and repeated submissions preserve the original acknowledgment', async () => {
    const db = database();
    const service = createLegalPolicyService({ database: db, manifest });
    const results = await Promise.all([service.acknowledge(12, versions), service.acknowledge(12, versions)]);
    assert.equal(db.rows.size, 1);
    for (const result of results) assert.equal(result.acknowledged_at, storedAt.toISOString());
    assert.equal((await service.acknowledge(12, versions)).acknowledged_at, storedAt.toISOString());
});

test('stale versions and forged fields cannot produce a record', async () => {
    const db = database();
    const service = createLegalPolicyService({ database: db, manifest });
    for (const field of Object.keys(versions)) {
        await assert.rejects(service.acknowledge(12, { ...versions, [field]: 'old' }), { code: 'LEGAL_POLICY_CHANGED', statusCode: 409 });
    }
    for (const body of [null, [], 'invalid', {}, { ...versions, user_id: 99 }, { ...versions, acknowledged_at: '2000-01-01' }]) {
        await assert.rejects(service.acknowledge(12, body), { statusCode: 400 });
    }
    assert.equal(db.calls.length, 0);
});

test('only a material Terms acknowledgment version triggers another prompt', async () => {
    const db = database();
    await createLegalPolicyService({ database: db, manifest }).acknowledge(12, versions);
    const revisedDocuments = structuredClone(publishedPolicies);
    revisedDocuments.privacy.version = 'next-privacy';
    revisedDocuments.terms.version = 'editorial-terms';
    assert.equal((await createLegalPolicyService({ database: db, manifest, policies: revisedDocuments }).status(12)).required, false);
    assert.equal((await createLegalPolicyService({ database: db, manifest: { ...manifest, acknowledgmentVersion: 'material-update' } }).status(12)).required, true);
});

test('database failures propagate without recording success', async () => {
    const service = createLegalPolicyService({ manifest, database: { query: async () => { throw new Error('offline'); } } });
    await assert.rejects(service.acknowledge(12, versions), /offline/);
});

test('legal exemptions match exact methods and paths', () => {
    for (const [method, path] of [['GET', '/api/auth/session'], ['GET', '/api/auth/csrf'], ['GET', '/api/auth/legal'], ['POST', '/api/auth/legal/acknowledge'], ['POST', '/api/auth/logout'], ['POST', '/api/account/password-change']]) {
        assert.equal(isLegalExemptRequest({ method, originalUrl: `${path}/?next=ignored` }), true);
    }
    for (const [method, path] of [['GET', '/api/students'], ['POST', '/api/account/student-onboarding/profile'], ['GET', '/api/auth/legal/other'], ['POST', '/api/auth/session']]) {
        assert.equal(isLegalExemptRequest({ method, originalUrl: path }), false);
    }
});

test('controller returns a generic failed-save error and authenticates the actor server-side', async () => {
    let actor;
    const controller = createLegalPolicyController({ service: { acknowledge: async (id) => { actor = id; throw new Error('database secret'); } } });
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await controller.acknowledge({ user: { id: 12 }, body: versions }, res);
    assert.equal(actor, 12);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.code, 'LEGAL_ACKNOWLEDGMENT_FAILED');
    assert.doesNotMatch(JSON.stringify(res.body), /database secret/);
});

test('protected APIs deny pending acknowledgment but preserve remediation endpoints', async () => {
    const middleware = createLegalPolicyMiddleware({ status: async () => ({ required: true }) });
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let reached = false;
    await middleware({ method: 'GET', originalUrl: '/api/students', user: { id: 12 } }, res, () => { reached = true; });
    assert.equal(reached, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'TERMS_ACKNOWLEDGMENT_REQUIRED');
    for (const [method, path] of [['GET', '/api/auth/legal'], ['GET', '/api/auth/session'], ['POST', '/api/auth/logout'], ['POST', '/api/account/password-change']]) {
        reached = false;
        await middleware({ method, originalUrl: path, user: { id: 12 } }, res, () => { reached = true; });
        assert.equal(reached, true);
    }
    const allowed = createLegalPolicyMiddleware({ status: async () => ({ required: false }) });
    reached = false;
    await allowed({ method: 'GET', originalUrl: '/api/students', user: { id: 12 } }, res, () => { reached = true; });
    assert.equal(reached, true);
    const offline = createLegalPolicyMiddleware({ status: async () => { throw new Error('private'); } });
    await offline({ method: 'GET', originalUrl: '/api/students', user: { id: 12 } }, res, () => assert.fail('failed checks must not allow access'));
    assert.equal(res.statusCode, 500);
});

test('required password changes take precedence over acknowledgment and protected access', async () => {
    const user = { id: 12, must_change_password: true };
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const service = { status: async () => assert.fail('password requirement must be checked first'), acknowledge: async () => assert.fail('must not acknowledge before password change') };
    await createLegalPolicyMiddleware(service)({ method: 'GET', originalUrl: '/api/students', user }, res, () => assert.fail('must not allow access'));
    assert.equal(res.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
    await createLegalPolicyController({ service }).acknowledge({ user, body: versions }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
});
