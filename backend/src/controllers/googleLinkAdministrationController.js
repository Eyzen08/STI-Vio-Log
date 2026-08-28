const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createGoogleLinkAdministrationService } = require('../services/googleLinkAdministrationService');

const createGoogleLinkAdministrationController = ({ service = createGoogleLinkAdministrationService({ pool }) } = {}) => {
  const revoke = async (req, res) => {
    try {
      assertAllowedFields(req.body, ['reason']);
      const recovery = await service.revokeStudentLink({ actorId: req.user.id, studentId: req.params.studentId, reason: req.body?.reason });
      return res.json({ success: true, message: 'Google link revoked. The student must complete the normal linking flow again.', recovery });
    } catch (error) {
      return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Google link recovery failed');
    }
  };
  return { revoke };
};

module.exports = { createGoogleLinkAdministrationController, ...createGoogleLinkAdministrationController() };
