const { createHash } = require('node:crypto');
const pool = require('../config/database');
const { ApiError } = require('../utils/api');
const { assertAllowedFields } = require('../utils/validators');
const { legalPolicyManifest, publishedPolicies } = require('../../../shared/legalPolicies.mjs');

const versionFields = ['acknowledgment_version', 'terms_version', 'privacy_notice_version'];
const hash = (document) => createHash('sha256').update(JSON.stringify(document)).digest('hex');
const exemptRoutes = new Set([
    'GET /api/auth/session', 'GET /api/auth/csrf', 'GET /api/auth/legal',
    'POST /api/auth/legal/acknowledge', 'POST /api/auth/logout', 'POST /api/account/password-change'
]);
const isLegalExemptRequest = (req) => exemptRoutes.has(`${req.method} ${new URL(req.originalUrl, 'http://local.invalid').pathname.replace(/\/$/, '')}`);

const createLegalPolicyService = ({ database = pool, manifest = legalPolicyManifest, policies = publishedPolicies } = {}) => {
    const versions = {
        acknowledgment_version: manifest.acknowledgmentVersion,
        terms_version: policies.terms.version,
        privacy_notice_version: policies.privacy.version
    };
    const findAcknowledgment = async (userId) => (await database.query(
        'SELECT acknowledged_at FROM terms_acknowledgments WHERE user_id=$1 AND acknowledgment_version=$2',
        [userId, versions.acknowledgment_version]
    )).rows[0];
    const result = (record) => ({
        enforcement_enabled: manifest.enforcementEnabled,
        required: manifest.enforcementEnabled && !record,
        ...versions,
        acknowledged_at: record ? new Date(record.acknowledged_at).toISOString() : null,
        documents: policies
    });
    return {
        status: async (userId) => result(manifest.enforcementEnabled ? await findAcknowledgment(userId) : null),
        async acknowledge(userId, body) {
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Displayed policy versions are required');
            assertAllowedFields(body, versionFields);
            if (versionFields.some(field => typeof body[field] !== 'string' || !body[field])) throw new ApiError(400, 'VALIDATION_ERROR', 'Displayed policy versions are required');
            if (!manifest.enforcementEnabled) throw new ApiError(409, 'LEGAL_ACKNOWLEDGMENT_DISABLED', 'Terms acknowledgment is not currently required');
            if (versionFields.some(field => body[field] !== versions[field])) throw new ApiError(409, 'LEGAL_POLICY_CHANGED', 'The policies have changed. Review the current documents and try again');
            const inserted = (await database.query(
                `INSERT INTO terms_acknowledgments(user_id,acknowledgment_version,terms_version,privacy_notice_version,terms_hash,privacy_notice_hash)
                 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,acknowledgment_version) DO NOTHING RETURNING acknowledged_at`,
                [userId, versions.acknowledgment_version, versions.terms_version, versions.privacy_notice_version, hash(policies.terms), hash(policies.privacy)]
            )).rows[0];
            const record = inserted || await findAcknowledgment(userId);
            if (!record) throw new Error('Acknowledgment record was not saved');
            return result(record);
        }
    };
};

module.exports = { createLegalPolicyService, isLegalExemptRequest, ...createLegalPolicyService() };
