const ACTION_POLICY = Object.freeze({
    COMPLETE: Object.freeze({ from: ["OPEN"], to: "COMPLETE", reasonRequired: false }),
    CLEAR: Object.freeze({ from: ["OPEN"], to: "CLEAR", reasonRequired: true }),
    INVALID_CANCEL: Object.freeze({ from: ["OPEN"], to: "INVALID_CANCEL", reasonRequired: true }),
    REOPEN: Object.freeze({ from: ["COMPLETE", "CLEAR", "INVALID_CANCEL"], to: "OPEN", reasonRequired: true })
});

const MAX_REASON_LENGTH = 1000;
const {
    syncClearanceStatusForStudent
} = require("../controllers/clearanceController");

class ViolationWorkflowError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.name = "ViolationWorkflowError";
        this.statusCode = statusCode;
        this.code = code || (statusCode === 404 ? "RESOURCE_NOT_FOUND" : "INVALID_VIOLATION_TRANSITION");
    }
}

const normalizeAction = (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeReason = (value) =>
    typeof value === "string" ? value.trim() : "";

const validateActionRequest = (actionValue, reasonValue) => {
    const action = normalizeAction(actionValue);
    const policy = ACTION_POLICY[action];

    if (!policy) {
        throw new ViolationWorkflowError("Invalid violation action", 400, "VALIDATION_ERROR");
    }

    const reason = normalizeReason(reasonValue);

    if (policy.reasonRequired && !reason) {
        throw new ViolationWorkflowError(`A reason is required for ${action}`, 400, "REASON_REQUIRED");
    }

    if (reason.length > MAX_REASON_LENGTH) {
        throw new ViolationWorkflowError(`Reason must not exceed ${MAX_REASON_LENGTH} characters`, 400);
    }

    return { action, reason: reason || null, policy };
};

const insertViolationAction = async ({
    client,
    violationId,
    action,
    fromStatus,
    toStatus,
    reason,
    actor
}) => {
    const result = await client.query(
        `INSERT INTO violation_actions (
            violation_id, action, from_status, to_status, reason,
            performed_by_user_id, performed_by_role
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [violationId, action, fromStatus, toStatus, reason, actor.id, actor.role]
    );

    return result.rows[0];
};

const insertViolationAudit = async ({
    client,
    violationId,
    action,
    fromStatus,
    toStatus,
    reason,
    actor,
    ipAddress
}) => {
    const description = JSON.stringify({
        actor_role: actor.role,
        from_status: fromStatus,
        to_status: toStatus,
        reason: reason || null
    });

    await client.query(
        `INSERT INTO audit_logs (
            user_id, action, table_name, record_id, description, ip_address
         ) VALUES ($1, $2, 'violations', $3, $4, $5)`,
        [actor.id, action, violationId, description, ipAddress || null]
    );
};

const synchronizeAssignmentForAction = async ({ client, violationId, action }) => {
    const assignmentResult = await client.query(
        `SELECT *
         FROM community_service_assignments
         WHERE violation_id = $1
         FOR UPDATE`,
        [violationId]
    );

    if (assignmentResult.rows.length === 0) {
        return null;
    }

    const assignment = assignmentResult.rows[0];
    const completedHours = Number(assignment.completed_hours || 0);
    const remainingHours = Number(assignment.remaining_hours || 0);
    let status = assignment.status;
    let completedAt = assignment.completed_at;

    if (action === "COMPLETE") {
        if (remainingHours > 0) {
            throw new ViolationWorkflowError(
                "Community service must be completed before the violation can be completed",
                400
            );
        }
        status = "COMPLETED";
        completedAt = completedAt || new Date();
    } else if (action === "CLEAR") {
        status = "ADMIN_CLOSED";
        completedAt = null;
    } else if (action === "INVALID_CANCEL") {
        status = "INVALID_CANCELLED";
        completedAt = null;
    } else if (action === "REOPEN") {
        status = remainingHours <= 0
            ? "COMPLETED"
            : completedHours > 0
                ? "IN_PROGRESS"
                : "OPEN";
        completedAt = remainingHours <= 0 ? completedAt || new Date() : null;
    }

    const updatedResult = await client.query(
        `UPDATE community_service_assignments
         SET status = $1,
             completed_at = $2
         WHERE id = $3
         RETURNING *`,
        [status, completedAt, assignment.id]
    );

    return updatedResult.rows[0];
};

const transitionViolationWithClient = async ({
    client,
    violationId,
    action: actionValue,
    reason: reasonValue,
    actor,
    ipAddress
}) => {
    const { action, reason, policy } = validateActionRequest(actionValue, reasonValue);

    // Attendance updates lock assignments first. Use the same lock order for
    // explicit transitions to avoid assignment/violation deadlocks.
    await client.query(
        `SELECT id
         FROM community_service_assignments
         WHERE violation_id = $1
         FOR UPDATE`,
        [violationId]
    );

    const currentResult = await client.query(
        `SELECT * FROM violations WHERE id = $1 FOR UPDATE`,
        [violationId]
    );

    if (currentResult.rows.length === 0) {
        throw new ViolationWorkflowError("Violation not found", 404);
    }

    const current = currentResult.rows[0];

    if (!policy.from.includes(current.status)) {
        throw new ViolationWorkflowError(
            `Cannot ${action} a violation with status ${current.status}`,
            400
        );
    }

    const clearedAt = ["CLEAR", "COMPLETE"].includes(policy.to)
        ? new Date()
        : null;

    const updatedResult = await client.query(
        `UPDATE violations
         SET status = $1,
             cleared_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [policy.to, clearedAt, violationId]
    );

    const assignment = await synchronizeAssignmentForAction({
        client,
        violationId,
        action
    });

    const history = await insertViolationAction({
        client,
        violationId,
        action,
        fromStatus: current.status,
        toStatus: policy.to,
        reason,
        actor
    });

    await insertViolationAudit({
        client,
        violationId,
        action,
        fromStatus: current.status,
        toStatus: policy.to,
        reason,
        actor,
        ipAddress
    });

    const clearanceSync = await syncClearanceStatusForStudent(
        current.student_id,
        client
    );

    return {
        violation: updatedResult.rows[0],
        assignment,
        history,
        clearanceSync
    };
};

const transitionViolation = async ({ pool, violationId, action, reason, actor, ipAddress }) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await transitionViolationWithClient({
            client, violationId, action, reason, actor, ipAddress
        });
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Violation transition rollback error:", rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    ACTION_POLICY,
    ViolationWorkflowError,
    insertViolationAction,
    insertViolationAudit,
    transitionViolation,
    transitionViolationWithClient,
    synchronizeAssignmentForAction,
    validateActionRequest
};
