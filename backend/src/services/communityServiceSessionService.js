const pool = require("../config/database");
const { transitionViolationWithClient } = require("./violationWorkflowService");
const { notifyStudent } = require('./notificationService');

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

const validateEligible = (assignment, expectedStudentId, departmentId) => {
    if (departmentId && Number(assignment.department_id) !== Number(departmentId)) {
        throw new CommunityServiceSessionError("Community service assignment not found", 404);
    }
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
        validateEligible(assignment, expectedStudentId, departmentId);

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
        await notifyStudent(client, assignment.student_id, {
            title: 'Community service time-in recorded',
            message: `Time-in was recorded for assignment #${assignment.id}.`,
            type: 'SERVICE_TIME_IN',
            eventKey: `service-session:${session.id}:time-in`
        });
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

const CONDITIONS = new Set(['SATISFACTORY', 'NEEDS_FOLLOW_UP', 'INCIDENT_REPORTED']);

const recordTimeOut = async ({ assignmentId, expectedStudentId, departmentId, actor, notes, condition, ipAddress, writeQrLog = false }) => {
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
        validateEligible(assignment, expectedStudentId, departmentId);
        const session = sessionResult.rows[0];
        if (Number(session.department_id) !== Number(departmentId)) throw new CommunityServiceSessionError("No active community service session found", 409, "NO_ACTIVE_SESSION");

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_OUT", notes });
        const duration = (await client.query(
            `SELECT GREATEST(FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - $1::timestamptz)) / 60), 0)::int AS minutes`,
            [session.time_in]
        )).rows[0].minutes;
        const normalizedCondition = String(condition || '').toUpperCase();
        if (!CONDITIONS.has(normalizedCondition)) throw new CommunityServiceSessionError('Select the student service condition before time-out', 400);

        const completedSession = (await client.query(
            `UPDATE community_service_sessions
             SET time_out = CURRENT_TIMESTAMP, worked_minutes = $1, credited_minutes = 0,
                 status = 'COMPLETED', time_out_by_user_id = $2,
                 time_out_attendance_id = $3, service_condition = $5,
                 result_notes = $6, review_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND time_out IS NULL RETURNING *`,
            [duration, actor.id, attendance.id, session.id, normalizedCondition, notes || null]
        )).rows[0];
        if (!completedSession) throw new CommunityServiceSessionError("Community service session was already completed", 409);

        let scanLog = null;
        if (writeQrLog) {
            scanLog = (await client.query(
                `INSERT INTO qr_scan_logs
                    (student_id, scanned_by, department_id, scan_type, device_information, ip_address)
                 VALUES ($1, $2, $3, 'TIME_OUT', $4, $5) RETURNING *`,
                [assignment.student_id, actor.id, departmentId, notes || null, ipAddress || null]
            )).rows[0];
        }
        await insertAudit({ client, actor, action: "TIME_OUT_PENDING_REVIEW", sessionId: session.id, assignmentId, description: { worked_minutes: Number(duration), service_condition: normalizedCondition }, ipAddress });
        await notifyStudent(client, assignment.student_id, {
            title: 'Community service result submitted',
            message: `${duration} worked minute${Number(duration) === 1 ? '' : 's'} submitted for Discipline Office review.`,
            type: 'SERVICE_TIME_OUT',
            eventKey: `service-session:${session.id}:time-out`
        });
        await client.query("COMMIT");
        return { assignment, attendance, session: completedSession, scanLog };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        throw error;
    } finally { client.release(); }
};

const reviewServiceResult = async ({ sessionId, decision, reviewNotes, actor, ipAddress }) => {
    const normalizedDecision = String(decision || '').toUpperCase();
    if (!['APPROVE','REJECT'].includes(normalizedDecision) || !String(reviewNotes || '').trim()) throw new CommunityServiceSessionError('Decision and review notes are required', 400);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const session = (await client.query(`SELECT css.*,a.student_id,a.violation_id,a.required_hours,a.completed_hours,a.status AS assignment_status,v.status AS violation_status FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN violations v ON v.id=a.violation_id WHERE css.id=$1 FOR UPDATE OF css,a`,[Number(sessionId)])).rows[0];
        if(!session) throw new CommunityServiceSessionError('Service result not found',404);
        if(session.review_status!=='PENDING') throw new CommunityServiceSessionError('Service result was already reviewed',409);
        if(normalizedDecision==='REJECT'){
            const rejected=(await client.query(`UPDATE community_service_sessions SET review_status='REJECTED',reviewed_by_user_id=$2,reviewed_at=CURRENT_TIMESTAMP,review_notes=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,[session.id,actor.id,String(reviewNotes).trim()])).rows[0];
            await insertAudit({client,actor,action:'SERVICE_RESULT_REJECT',sessionId:session.id,assignmentId:session.assignment_id,description:{reason:String(reviewNotes).trim()},ipAddress});
            await notifyStudent(client,session.student_id,{title:'Community service result needs follow-up',message:'The Discipline Office did not credit the submitted service session. Contact the Discipline Office for guidance.',type:'SERVICE_RESULT_REJECTED',eventKey:`service-session:${session.id}:rejected`});
            await client.query('COMMIT');return{session:rejected};
        }
        const requiredMinutes=Math.round(Number(session.required_hours)*60),previousMinutes=Math.round(Number(session.completed_hours||0)*60),creditedMinutes=Math.min(Number(session.worked_minutes),Math.max(requiredMinutes-previousMinutes,0)),newMinutes=previousMinutes+creditedMinutes;
        const approved=(await client.query(`UPDATE community_service_sessions SET credited_minutes=$2,review_status='APPROVED',reviewed_by_user_id=$3,reviewed_at=CURRENT_TIMESTAMP,review_notes=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,[session.id,creditedMinutes,actor.id,String(reviewNotes).trim()])).rows[0];
        await client.query(`INSERT INTO community_service_progress_history(assignment_id,session_id,previous_completed_minutes,worked_minutes,credited_minutes,new_completed_minutes,performed_by_user_id)VALUES($1,$2,$3,$4,$5,$6,$7)`,[session.assignment_id,session.id,previousMinutes,session.worked_minutes,creditedMinutes,newMinutes,actor.id]);
        const remainingMinutes=Math.max(requiredMinutes-newMinutes,0),status=remainingMinutes===0?'COMPLETED':'IN_PROGRESS';
        const assignment=(await client.query(`UPDATE community_service_assignments SET completed_hours=$1,remaining_hours=$2,status=$3::violation_status,completed_at=CASE WHEN $3::text='COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=$4 RETURNING *`,[newMinutes/60,remainingMinutes/60,status,session.assignment_id])).rows[0];
        let violation=(await client.query('UPDATE violations SET completed_service_hours=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',[newMinutes/60,session.violation_id])).rows[0],clearanceSync=null;
        if(status==='COMPLETED'&&violation.status==='OPEN'){const transition=await transitionViolationWithClient({client,violationId:session.violation_id,action:'COMPLETE',reason:null,actor,ipAddress});violation=transition.violation;clearanceSync=transition.clearanceSync;}
        await insertAudit({client,actor,action:'SERVICE_RESULT_APPROVE',sessionId:session.id,assignmentId:session.assignment_id,description:{worked_minutes:Number(session.worked_minutes),credited_minutes:creditedMinutes},ipAddress});
        await notifyStudent(client,session.student_id,{title:status==='COMPLETED'?'Community service completed':'Community service result approved',message:`${creditedMinutes} service minute${creditedMinutes===1?'':'s'} approved by the Discipline Office.`,type:status==='COMPLETED'?'SERVICE_COMPLETED':'SERVICE_RESULT_APPROVED',eventKey:`service-session:${session.id}:approved`});
        await client.query('COMMIT');return{session:approved,assignment,violation,clearanceSync};
    }catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
};

module.exports = { CommunityServiceSessionError, recordTimeIn, recordTimeOut, reviewServiceResult, CONDITIONS };
