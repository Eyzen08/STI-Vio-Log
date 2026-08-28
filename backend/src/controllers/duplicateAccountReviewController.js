const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createDuplicateAccountReviewService } = require('../services/duplicateAccountReviewService');

const createDuplicateAccountReviewController = ({ service = createDuplicateAccountReviewService({ pool }) } = {}) => ({
  list: async (req, res) => {
    try { assertAllowedFields(req.query, []); return res.json({ success: true, ...await service.list() }); }
    catch (error) { return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Unable to review possible duplicate accounts'); }
  }
});
module.exports = { createDuplicateAccountReviewController, ...createDuplicateAccountReviewController() };
