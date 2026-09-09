const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createOfficerResponsibilityService } = require('../services/officerResponsibilityService');

const createOfficerResponsibilityController = ({ service = createOfficerResponsibilityService({ pool }) } = {}) => {
  const fail = (res, error) => sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Officer responsibility request failed');
  const list = async (req, res) => { try { assertAllowedFields(req.query, ['department_id', 'include_history']); return res.json({ success: true, assignments: await service.list({ departmentId: req.query.department_id, includeHistory: req.query.include_history === 'true' }) }); } catch (error) { return fail(res, error); } };
  const available = async (req, res) => { try { assertAllowedFields(req.query, ['department_id']); const departmentId = req.user.role === 'DISCIPLINE_ADMIN' ? req.query.department_id : req.user.department_id; return res.json({ success: true, officers: await service.available({ departmentId }) }); } catch (error) { return fail(res, error); } };
  const availability = async (req, res) => { try { assertAllowedFields(req.body, ['status', 'reason']); return res.json({ success: true, availability: await service.setAvailability({ actorId: req.user.id, officerId: req.params.officerId, status: req.body.status, reason: req.body.reason }) }); } catch (error) { return fail(res, error); } };
  const permanent = async (req, res) => { try { assertAllowedFields(req.body, ['officer_id', 'department_id', 'starts_at', 'reason']); return res.status(201).json({ success: true, assignment: await service.assignPermanent({ actorId: req.user.id, officerId: req.body.officer_id, departmentId: req.body.department_id, startsAt: req.body.starts_at, reason: req.body.reason }) }); } catch (error) { return fail(res, error); } };
  const temporary = async (req, res) => { try { assertAllowedFields(req.body, ['original_officer_id', 'replacement_officer_id', 'department_id', 'starts_at', 'ends_at', 'reason']); return res.status(201).json({ success: true, assignment: await service.createTemporary({ actorId: req.user.id, originalOfficerId: req.body.original_officer_id, replacementOfficerId: req.body.replacement_officer_id, departmentId: req.body.department_id, startsAt: req.body.starts_at, endsAt: req.body.ends_at, reason: req.body.reason }) }); } catch (error) { return fail(res, error); } };
  const transition = async (req, res) => { try { assertAllowedFields(req.body, ['action', 'ends_at', 'reason']); return res.json({ success: true, assignment: await service.transitionTemporary({ actorId: req.user.id, assignmentId: req.params.assignmentId, action: req.body.action, endsAt: req.body.ends_at, reason: req.body.reason }) }); } catch (error) { return fail(res, error); } };
  return { list, available, availability, permanent, temporary, transition };
};

module.exports = { createOfficerResponsibilityController, ...createOfficerResponsibilityController() };
