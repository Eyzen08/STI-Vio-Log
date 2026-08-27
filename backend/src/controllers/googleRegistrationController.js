const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createGoogleRegistrationService } = require('../services/googleRegistrationService');

const createGoogleRegistrationController = ({ service = createGoogleRegistrationService({ pool }) } = {}) => {
  const fail = (res, error) => sendError(
    res,
    error.statusCode || 500,
    error.code || 'INTERNAL_ERROR',
    error.statusCode ? error.message : 'Registration review failed'
  );

  const list = async (req, res) => {
    try {
      assertAllowedFields(req.query, ['status', 'limit']);
      const registrations = await service.list(req.query);
      return res.json({ success: true, registrations });
    } catch (error) { return fail(res, error); }
  };

  const decide = (decision) => async (req, res) => {
    try {
      assertAllowedFields(req.body, ['reason']);
      const registration = await service.review({
        registrationId: req.params.id,
        reviewerId: req.user.id,
        decision,
        reason: req.body?.reason
      });
      return res.json({ success: true, message: `Registration ${decision.toLowerCase()}`, registration });
    } catch (error) { return fail(res, error); }
  };

  return { list, approve: decide('APPROVED'), reject: decide('REJECTED') };
};

module.exports = { createGoogleRegistrationController, ...createGoogleRegistrationController() };
