const handbookOffenses = require('../../../shared/handbookOffenses.json');
const { assertAllowedFields, isPositiveId } = require('../utils/validators');
const { validateServiceDestination } = require('./serviceAssignmentDestination');
const { transitionViolationWithClient } = require('./violationWorkflowService');
const { syncClearanceStatusForStudent } = require('../controllers/clearanceController');
const { recalculateOffenseStatus } = require('./offenseEscalationService');
const { notifyStudent } = require('./notificationService');

const editableFields = ['violation_type_id', 'incident_date', 'incident_time', 'description', 'required_service_hours', 'completed_service_hours'];
const fail = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const parseHours = (value, field) => {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') fail(`${field} must be a number`);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 9999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
        fail(`${field} must be between 0 and 9999.99 with at most two decimal places`);
    }
    return amount;
};

const validateEdit = (body, actor) => {
    assertAllowedFields(body, [...editableFields, 'reason', 'department_id', 'department_head_id']);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 1000) fail('A change reason of 1 to 1000 characters is required');
    const fields = Object.fromEntries(editableFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
    if (!Object.keys(fields).length) fail('No violation fields provided for update');
    if (fields.violation_type_id !== undefined && !isPositiveId(fields.violation_type_id)) fail('Select a valid violation classification');
    if (fields.incident_date !== undefined && !validDate(fields.incident_date)) fail('Enter a valid incident date');
    if (fields.incident_time !== undefined) {
        if (fields.incident_time !== null && fields.incident_time !== '' && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(fields.incident_time))) fail('Enter a valid 24-hour incident time');
        fields.incident_time = fields.incident_time || null;
    }
    if (fields.description !== undefined) {
        if (typeof fields.description !== 'string' || !fields.description.trim()) fail('Incident details are required');
        fields.description = fields.description.trim();
    }
    for (const field of ['required_service_hours', 'completed_service_hours']) {
        if (fields[field] !== undefined) fields[field] = parseHours(fields[field], field);
    }
    return { fields, reason, actor };
};

const editViolationWithClient = async ({ client, violationId, body, actor, ipAddress }) => {
    if (!isPositiveId(violationId)) fail('Violation ID must be a positive ID');
    const { fields, reason } = validateEdit(body, actor);
    // Follow the same assignment -> violation lock order as attendance.
    let assignment = (await client.query('SELECT * FROM community_service_assignments WHERE violation_id = $1 FOR UPDATE', [violationId])).rows[0] || null;
    const current = (await client.query('SELECT * FROM violations WHERE id = $1 FOR UPDATE', [violationId])).rows[0];
    if (!current) fail('Violation not found', 404);
    if (current.status !== 'OPEN') fail('Reopen this violation before editing it', 409);

    const typeId = Number(fields.violation_type_id ?? current.violation_type_id);
    const type = (await client.query('SELECT * FROM violation_types WHERE id = $1', [typeId])).rows[0];
    if (!type || (!type.is_active && typeId !== Number(current.violation_type_id))) fail('Select an active violation classification');
    const offense = /^Handbook offense: ([^\n]+)\nIncident details: ([\s\S]*)$/.exec(fields.description ?? current.description ?? '');
    const originalOffense = /^Handbook offense: ([^\n]+)\nIncident details: /s.exec(current.description || '');
    if (typeId !== Number(current.violation_type_id) || (offense && offense[1] !== originalOffense?.[1])) {
        const choices = [...(handbookOffenses[type.violation_code] || []), 'Other offense for Discipline Committee review'];
        if (handbookOffenses[type.violation_code] && (!offense || !choices.includes(offense[1]))) {
            fail('Select a handbook offense belonging to the new classification');
        }
    }
    if (offense && !offense[2].trim()) fail('Incident details are required');

    const required = fields.required_service_hours ?? Number(current.required_service_hours);
    const completed = fields.completed_service_hours ?? Number(current.completed_service_hours);
    if (completed > required) fail('Completed hours cannot exceed required hours');
    const hoursChanged = required !== Number(current.required_service_hours) || completed !== Number(current.completed_service_hours);
    const completedChanged = completed !== Number(current.completed_service_hours);
    if (completedChanged && actor.role !== 'DISCIPLINE_ADMIN') fail('Only admins can correct completed service hours', 403);
    if (assignment && hoursChanged) {
        const active = await client.query('SELECT id FROM community_service_sessions WHERE assignment_id = $1 AND time_out IS NULL', [assignment.id]);
        if (active.rows.length) fail('Time out the active attendance session before changing hours', 409);
    }
    const hasDestination = body.department_id !== undefined || body.department_head_id !== undefined;
    if (assignment && hasDestination) fail('The existing service assignment routing cannot be changed here');
    let createdAssignment = false;
    if (!assignment && required > 0) {
        if (![body.department_id, body.department_head_id].every(isPositiveId)) fail('Select a department and Department Head to assign service hours');
        await validateServiceDestination(client, body.department_id, body.department_head_id);
        assignment = (await client.query(
            `INSERT INTO community_service_assignments
                (violation_id, student_id, department_id, department_head_id, required_hours, completed_hours, remaining_hours, status)
             VALUES ($1, $2, $3, $4, $5, 0, $5, 'OPEN') RETURNING *`,
            [current.id, current.student_id, body.department_id, body.department_head_id, required]
        )).rows[0];
        createdAssignment = true;
    } else if (!assignment && hasDestination) fail('Department routing is only accepted when creating a positive-hour assignment');

    const changes = Object.fromEntries(Object.entries(fields).filter(([field, value]) => String(value ?? '') !== String(current[field] ?? '')).map(([field, value]) => [field, { before: current[field], after: value }]));
    const entries = Object.entries(fields);
    let violation = (await client.query(
        `UPDATE violations SET ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), violationId]
    )).rows[0];
    let hourCorrection = null;
    if (assignment && completedChanged) {
        hourCorrection = (await client.query(
            `INSERT INTO community_service_hour_corrections
                (assignment_id, previous_completed_hours, new_completed_hours, performed_by_user_id, reason)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [assignment.id, current.completed_service_hours, completed, actor.id, reason]
        )).rows[0];
    }
    if (assignment && (hoursChanged || createdAssignment)) {
        const remaining = Math.round((required - completed) * 100) / 100;
        const status = remaining === 0 ? 'COMPLETED' : completed > 0 ? 'IN_PROGRESS' : 'OPEN';
        assignment = (await client.query(
            `UPDATE community_service_assignments SET required_hours = $1, completed_hours = $2, remaining_hours = $3,
                 status = $4::violation_status, completed_at = CASE WHEN $4::text = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END
             WHERE id = $5 RETURNING *`, [required, completed, remaining, status, assignment.id]
        )).rows[0];
    }
    if (assignment && (hoursChanged || createdAssignment) && required > 0 && completed === required) {
        const transition = await transitionViolationWithClient({ client, violationId, action: 'COMPLETE', reason, actor, ipAddress });
        violation = transition.violation;
        assignment = transition.assignment;
    }
    const clearanceSync = await syncClearanceStatusForStudent(current.student_id, client);
    const offenseStatus = await recalculateOffenseStatus({ client, studentId: current.student_id, actor, ipAddress });
    await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address, actor_role, previous_values, new_values, reason, result)
         VALUES ($1, 'UPDATE', 'violations', $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'SUCCESS')`,
        [actor.id, current.id, JSON.stringify({ actor_role: actor.role, fields: Object.keys(changes), changes, reason }), ipAddress || null, actor.role,
            JSON.stringify(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.before]))),
            JSON.stringify(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.after]))), reason]
    );
    await notifyStudent(client, current.student_id, {
        title: 'Violation record updated', message: `Violation #${current.id} was corrected. Review your violation and service details.`, type: 'VIOLATION_UPDATED',
        eventKey: `violation:${current.id}:updated:${require('node:crypto').randomUUID()}`
    });
    return { violation: { ...violation, violation_code: type.violation_code, violation_name: type.violation_name,
        severity: type.severity, exact_offense: offense?.[1] || null }, assignment, hourCorrection, clearanceSync, offenseStatus };
};

module.exports = { editViolationWithClient, validateEdit, parseHours, validDate };
