const service = require('../services/legalPolicyService');
const { sendError } = require('../utils/api');

const createLegalPolicyMiddleware = (policies = service) => async (req, res, next) => {
    if (service.isLegalExemptRequest(req)) return next();
    if (req.user.must_change_password) return sendError(res, 403, 'PASSWORD_CHANGE_REQUIRED', 'Password change required');
    try {
        if ((await policies.status(req.user.id)).required) return sendError(res, 403, 'TERMS_ACKNOWLEDGMENT_REQUIRED', 'Acknowledge the current Terms of Use before continuing');
        return next();
    } catch (_) {
        return sendError(res, 500, 'LEGAL_STATUS_FAILED', 'Unable to verify Terms acknowledgment');
    }
};

module.exports = { createLegalPolicyMiddleware, requireLegalAcknowledgment: createLegalPolicyMiddleware() };
