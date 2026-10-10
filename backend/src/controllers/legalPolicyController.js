const legalPolicyService = require('../services/legalPolicyService');
const { sendError } = require('../utils/api');

const createLegalPolicyController = ({ service = legalPolicyService } = {}) => ({
    async status(req, res) {
        try { return res.json({ success: true, legal: await service.status(req.user.id) }); }
        catch (error) { return sendError(res, error.statusCode || 500, error.code || 'LEGAL_STATUS_FAILED', error.statusCode ? error.message : 'Unable to verify Terms acknowledgment'); }
    },
    async acknowledge(req, res) {
        if (req.user.must_change_password) return sendError(res, 403, 'PASSWORD_CHANGE_REQUIRED', 'Password change required');
        try { return res.json({ success: true, legal: await service.acknowledge(req.user.id, req.body) }); }
        catch (error) { return sendError(res, error.statusCode || 500, error.code || 'LEGAL_ACKNOWLEDGMENT_FAILED', error.statusCode ? error.message : 'Unable to save Terms acknowledgment. Please try again'); }
    }
});

module.exports = { createLegalPolicyController, ...createLegalPolicyController() };
