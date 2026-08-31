const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createDepartmentAccountService } = require('../services/departmentAccountService');

const createDepartmentAccountController = ({ service = createDepartmentAccountService({ pool }) } = {}) => {
  const fail = (res, error) => sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Department Account administration failed');
  const list = async (req, res) => { try { assertAllowedFields(req.query, ['page','limit','status','search']); return res.json({ success: true, ...await service.list(req.query) }); } catch (error) { return fail(res, error); } };
  const options = async (_req, res) => { try { return res.json({ success: true, ...await service.options() }); } catch (error) { return fail(res, error); } };
  const create = async (req, res) => { try { assertAllowedFields(req.body, ['username','department_id']); const result = await service.create({ actorId: req.user.id, username: req.body?.username, departmentId: req.body?.department_id }); return res.status(201).json({ success: true, message: 'Department Account created', ...result }); } catch (error) { return fail(res, error); } };
  const status = async (req, res) => { try { assertAllowedFields(req.body, ['is_active','reason']); return res.json({ success: true, account: await service.setStatus({ actorId: req.user.id, targetId: req.params.id, isActive: req.body?.is_active, reason: req.body?.reason }) }); } catch (error) { return fail(res, error); } };
  const reset = async (req, res) => { try { assertAllowedFields(req.body, ['reason']); return res.json({ success: true, ...await service.resetPassword({ actorId: req.user.id, targetId: req.params.id, reason: req.body?.reason }) }); } catch (error) { return fail(res, error); } };
  return { list, options, create, status, reset };
};

module.exports = { createDepartmentAccountController, ...createDepartmentAccountController() };
