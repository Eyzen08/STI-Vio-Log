const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createParentContactService } = require('../services/parentContactService');

const createParentContactController = ({ service = createParentContactService({ pool }) } = {}) => {
  const fail = (res, error) => sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Parent contact request failed');
  const read = async (req, res) => { try { assertAllowedFields(req.query, []); return res.json({ success: true, ...(await service.read({ actor: req.user, studentId: req.params.studentId })) }); } catch (error) { return fail(res, error); } };
  const record = async (req, res) => { try { assertAllowedFields(req.body, ['guardian_id', 'contact_method', 'outcome', 'notes']); const contact = await service.record({ actor: req.user, studentId: req.params.studentId, guardianId: req.body?.guardian_id, method: req.body?.contact_method, outcome: req.body?.outcome, notes: req.body?.notes, ipAddress: req.ip || null }); return res.status(201).json({ success: true, message: 'Parent or guardian contact recorded', contact }); } catch (error) { return fail(res, error); } };
  return { read, record };
};

module.exports = { createParentContactController, ...createParentContactController() };

