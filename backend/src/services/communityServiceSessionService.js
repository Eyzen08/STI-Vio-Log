const pool = require("../config/database");
const { transitionViolationWithClient } = require("./violationWorkflowService");

class CommunityServiceSessionError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.name = "CommunityServiceSessionError";
        this.statusCode = statusCode;
        this.code = code || ({ 404: "RESOURCE_NOT_FOUND", 409: "DATABASE_CONFLICT" }[statusCode] || "VALIDATION_ERROR");
    }
}

const loadAssignment = async (client, assignmentId, lock = false) => {
    const result = await client.query(
        `SELECT a.*, v.status AS violation_status
         FROM community_service_assignments a
         JOIN violations v ON v.id = a.violation_id
         WHERE a.id = $1${lock ? " FOR UPDATE OF a" : ""}`,
        [assignmentId]
    );
    if (!result.rows.length) throw new CommunityServiceSessionError("Community service assignment not found", 404);
    return result.rows[0];
};

const validateEligible = (assignment, expectedStudentId) => {
    if (expectedStudentId && Number(assignment.student_id) !== Number(expectedStudentId)) {
        throw new CommunityServiceSessionError("The assignment does not belong to the specified student", 400);
    }
    if (!["OPEN", "IN_PROGRESS"].includes(assignment.status)) {
        throw new CommunityServiceSessionError("This community service assignment is not active", 400);
    }
    if (assignment.violation_status !== "OPEN") {
        throw new CommunityServiceSessionError("Attendance is not allowed for a closed violation", 400);
    }
};

const insertAttendance = async ({ client, assignment, departmentId, actorId, type, notes }) => {
    const result = await client.query(
        `INSERT INTO community_service_attendance
            (assignment_id, student_id, department_id, scanned_by, attendance_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [assignment.id, assignment.student_id, departmentId, actorId, type, notes || null]
    );
    return result.rows[0];
};

const insertAudit = ({ client, actor, action, sessionId, assignmentId, description, ipAddress }) =>
    client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
         VALUES ($1, $2, 'community_service_sessions', $3, $4, $5)`,
        [actor.id, action, sessionId, JSON.stringify({ assignment_id: Number(assignmentId), ...description }), ipAddress || null]
    );

const recordTimeIn = async ({ assignmentId, expectedStudentId, departmentId, actor, notes, ipAddress, writeQrLog = false }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const assignment = await loadAssignment(client, assignmentId, true);
        validateEligible(assignment, expectedStudentId);

        const active = await client.query(
            `SELECT id, time_in FROM community_service_sessions
             WHERE assignment_id = $1 AND time_out IS NULL`,
            [assignmentId]
        );
        if (active.rows.length) throw new CommunityServiceSessionError("Assignment already has an active community service session", 409, "ACTIVE_SESSION_EXISTS");

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_IN", notes });
        const sessionResult = await client.query(
            `INSERT INTO community_service_sessions
                (assignment_id, department_id, time_in_by_user_id, time_in_attendance_id, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [assignmentId, departmentId, actor.id, attendance.id, notes || null]
        );
        const session = sessionResult.rows[0];
        let scanLog = null;
        if (writeQrLog) {
            scanLog = (await client.query(
                `INSERT INTO qr_scan_logs
                    (student_id, scanned_by, department_id, scan_type, device_information, ip_address)
                 VALUES ($1, $2, $3, 'TIME_IN', $4, $5) RETURNING *`,
                [assignment.student_id, actor.id, departmentId, notes || null, ipAddress || null]
            )).rows[0];
        }
        await insertAudit({ client, actor, action: "TIME_IN", sessionId: session.id, assignmentId, description: { department_id: Number(departmentId) }, ipAddress });
        await client.query("COMMIT");
        return { assignment, attendance, session, scanLog };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        if (error.code === "23505" && error.constraint === "uq_community_service_active_session") {
            throw new CommunityServiceSessionError("Assignment already has an active community service session", 409, "ACTIVE_SESSION_EXISTS");
        }
        throw error;
    } finally { client.release(); }
};

const recordTimeOut = async ({ assignmentId, expectedStudentId, departmentId, actor, notes, ipAddress, writeQrLog = false }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const assignment = await loadAssignment(client, assignmentId, true);
        const sessionResult = await client.query(
            `SELECT * FROM community_service_sessions
             WHERE assignment_id = $1 AND time_out IS NULL
             FOR UPDATE`, [assignmentId]
        );
        if (!sessionResult.rows.length) throw new CommunityServiceSessionError("No active community service session found", 409, "NO_ACTIVE_SESSION");
        validateEligible(assignment, expectedStudentId);
        const session = sessionResult.rows[0];

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_OUT", notes });
        const duration = (await client.query(
            `SELECT GREATEST(FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - $1::timestamptz)) / 60), 0)::int AS minutes`,
            [session.time_in]
        )).rows[0].minutes;
        const requiredMinutes = Math.round(Number(assignment.required_hours) * 60);
        const previousMinutes = Math.round(Number(assignment.completed_hours || 0) * 60);
        const creditedMinutes = Math.min(Number(duration), Math.max(requiredMinutes - previousMinutes, 0));
        const newMinutes = previousMinutes + creditedMinutes;

        const completedSession = (await client.query(
            `UPDATE community_service_sessions
             SET time_out = CURRENT_TIMESTAMP, worked_minutes = $1, credited_minutes = $2,
                 status = 'COMPLETED', time_out_by_user_id = $3,
                 time_out_attendance_id = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND time_out IS NULL RETURNING *`,
            [duration, creditedMinutes, actor.id, attendance.id, session.id]
        )).rows[0];
        if (!completedSession) throw new CommunityServiceSessionError("Community service session was already completed", 409);

        await client.query(
            `INSERT INTO community_service_progress_history
                (assignment_id, session_id, previous_completed_minutes, worked_minutes,
                 credited_minutes, new_completed_minutes, performed_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [assignmentId, session.id, previousMinutes, duration, creditedMinutes, newMinutes, actor.id]
        );
        const newHours = newMinutes / 60;
        const remainingHours = Math.max((requiredMinutes - newMinutes) / 60, 0);
        const status = remainingHours === 0 ? "COMPLETED" : "IN_PROGRESS";
        const updatedAssignment = (await client.query(
            `UPDATE community_service_assignments SET completed_hours = $1, remaining_hours = $2,
                 status = $3::violation_status,
                 completed_at = CASE WHEN $3::text = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = $4 RETURNING *`,
            [newHours, remainingHours, status, assignmentId]
        )).rows[0];
        let updatedViolation = (await client.query(
            `UPDATE violations SET completed_service_hours = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`, [newHours, assignment.violation_id]
        )).rows[0];
        let clearanceSync = null;
        if (status === "COMPLETED" && updatedViolation.status === "OPEN") {
            const transition = await transitionViolationWithClient({ client, violationId: assignment.violation_id, action: "COMPLETE", reason: null, actor, ipAddress });
            updatedViolation = transition.violation;
            clearanceSync = transition.clearanceSync;
        }
        let scanLog = null;
        if (writeQrLog) {
            scanLog = (await client.query(
                `INSERT INTO qr_scan_logs
                    (student_id, scanned_by, department_id, scan_type, device_information, ip_address)
                 VALUES ($1, $2, $3, 'TIME_OUT', $4, $5) RETURNING *`,
                [assignment.student_id, actor.id, departmentId, notes || null, ipAddress || null]
            )).rows[0];
        }
        await insertAudit({ client, actor, action: "TIME_OUT", sessionId: session.id, assignmentId, description: { worked_minutes: Number(duration), credited_minutes: creditedMinutes }, ipAddress });
        await client.query("COMMIT");
        return { assignment: updatedAssignment, violation: updatedViolation, clearanceSync, attendance, session: completedSession, scanLog };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        throw error;
    } finally { client.release(); }
};

module.exports = { CommunityServiceSessionError, recordTimeIn, recordTimeOut };
