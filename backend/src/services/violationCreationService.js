const { ApiError } = require('../utils/api');
const { serviceDate } = require('./communityServiceTiming');
const { insertViolationAction, insertViolationAudit } = require('./violationWorkflowService');
const { recalculateOffenseStatus } = require('./offenseEscalationService');
const { notifyStudent } = require('./notificationService');
const { syncClearanceStatusForStudent } = require('../controllers/clearanceController');

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    && !Number.isNaN(new Date(`${value}T00:00:00+08:00`).getTime());
const isTimeOfDay = (value) => value === null || value === undefined || value === ''
    || /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value));

// The browser date/time must never decide which calendar day a new incident
// belongs to. `serviceDate` resolves the current date in Asia/Manila, matching
// the rest of the attendance and clearance workflows.
const currentManilaDate = (now = new Date()) => serviceDate(now);

const requireCurrentIncidentDate = (incidentDate, now = new Date()) => {
    if (!isIsoDate(incidentDate)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid incident date in YYYY-MM-DD format');
    }
    if (incidentDate !== currentManilaDate(now)) {
        throw new ApiError(400, 'INCIDENT_DATE_NOT_TODAY', 'New violations must use today\'s date in Asia/Manila. Historical corrections must use the authorized edit workflow.');
    }
};

const normalizeViolationInput = ({ studentId, violationTypeId, incidentDate, incidentTime, description, now = new Date() }) => {
    if (!/^\d+$/.test(String(studentId)) || Number(studentId) < 1) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'A valid student is required');
    }
    if (!/^\d+$/.test(String(violationTypeId)) || Number(violationTypeId) < 1) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'A valid violation classification is required');
    }
    requireCurrentIncidentDate(incidentDate, now);
    if (!isTimeOfDay(incidentTime)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid incident time');
    }
    if (description !== null && description !== undefined && typeof description !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Incident details must be text');
    }
    return {
        studentId: Number(studentId),
        violationTypeId: Number(violationTypeId),
        incidentDate,
        incidentTime: incidentTime || null,
        description: typeof description === 'string' && description.trim() ? description : null
    };
};

// Creates the violation and every dependent disciplinary record. The caller
// owns the transaction so account registration and violation creation can
// commit or roll back together.
const createViolationWithClient = async ({
    client, studentId, violationTypeId, incidentDate, incidentTime, description,
    actor, ipAddress = null, now = new Date()
}) => {
    if (!client?.query) throw new TypeError('A database client is required');
    if (!actor?.id || !actor?.role) throw new TypeError('An authenticated actor is required');

    const input = normalizeViolationInput({
        studentId, violationTypeId, incidentDate, incidentTime, description, now
    });

    const violationType = (await client.query(
        'SELECT id FROM violation_types WHERE id=$1 AND is_active=TRUE',
        [input.violationTypeId]
    )).rows[0];
    if (!violationType) throw new ApiError(400, 'INVALID_VIOLATION_TYPE', 'Select an active handbook classification');

    const violation = (await client.query(
        `INSERT INTO violations (
            student_id, violation_type_id, reported_by, incident_date, incident_time,
            description, status, required_service_hours, completed_service_hours, cleared_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'OPEN',0,0,NULL)
         RETURNING *`,
        [
            input.studentId, input.violationTypeId, actor.id, input.incidentDate,
            input.incidentTime, input.description
        ]
    )).rows[0];

    const history = await insertViolationAction({
        client, violationId: violation.id, action: 'CREATE',
        fromStatus: null, toStatus: 'OPEN', reason: null, actor
    });

    await insertViolationAudit({
        client, violationId: violation.id, action: 'CREATE',
        fromStatus: null, toStatus: 'OPEN', reason: null, actor, ipAddress
    });

    const clearanceSync = await syncClearanceStatusForStudent(violation.student_id, client);
    const offenseStatus = await recalculateOffenseStatus({
        client, studentId: violation.student_id, actor, ipAddress
    });

    await notifyStudent(client, violation.student_id, {
        title: 'New violation recorded',
        message: `Violation #${violation.id} was added to your disciplinary record. Review the details in My Violations.`,
        type: 'VIOLATION_CREATED',
        category: 'VIOLATIONS', resourceType: 'violations', resourceId: violation.id,
        linkPath: `/student/violations?violation_id=${violation.id}`,
        metadata: { student_id: violation.student_id },
        eventKey: `violation:${violation.id}:created`
    });

    return { violation, assignment: null, history, clearanceSync, offenseStatus };
};

module.exports = {
    currentManilaDate,
    requireCurrentIncidentDate,
    normalizeViolationInput,
    createViolationWithClient
};
