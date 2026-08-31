const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');
const { createAccountAdministrationService } = require('./accountAdministrationService');

const createDepartmentAccountService = ({ pool, accountService = createAccountAdministrationService({ pool }) } = {}) => {
  if (!pool?.query) throw new TypeError('Department account dependencies are required');

  const assertDepartmentTarget = async (targetId) => {
    if (!isPositiveId(targetId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Valid Department Account is required');
    const target = (await pool.query("SELECT id FROM users WHERE id=$1 AND role='DEPARTMENT_HEAD'", [Number(targetId)])).rows[0];
    if (!target) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Department Account not found');
  };

  const list = (filters = {}) => accountService.list({ ...filters, role: 'DEPARTMENT_HEAD' });
  const options = async () => ({ departments: (await pool.query('SELECT id,department_name FROM departments WHERE is_active=TRUE ORDER BY department_name')).rows });

  const create = async ({ actorId, username, departmentId }) => {
    if (!isPositiveId(departmentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Select an active department');
    const department = (await pool.query('SELECT id,department_name FROM departments WHERE id=$1 AND is_active=TRUE', [Number(departmentId)])).rows[0];
    if (!department) throw new ApiError(400, 'VALIDATION_ERROR', 'Select an active department');
    return accountService.create({
      actorId,
      username,
      role: 'DEPARTMENT_HEAD',
      firstName: department.department_name,
      lastName: 'Account',
      departmentId: Number(departmentId),
      enforceSingleDepartmentAccount: true
    });
  };

  const setStatus = async (args) => { await assertDepartmentTarget(args.targetId); return accountService.setStatus(args); };
  const resetPassword = async (args) => { await assertDepartmentTarget(args.targetId); return accountService.resetPassword(args); };

  return { list, options, create, setStatus, resetPassword };
};

module.exports = { createDepartmentAccountService };
