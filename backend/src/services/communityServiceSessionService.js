const pool = require("../config/database");
const { transitionViolationWithClient } = require("./violationWorkflowService");
const { notifyStudent, notifyAttendanceStaff } = require('./notificationService');

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

const availableSupervisors = async (client, departmentId) => (await client.query(
    `SELECT DISTINCT ON (oda.officer_user_id)
            oda.id AS assignment_id,oda.officer_user_id,oda.assignment_type,oda.original_officer_user_id,
            u.role,COALESCE(sp.first_name,dh.first_name) AS first_name,
            COALESCE(sp.last_name,dh.last_name) AS last_name,d.department_name,
            COALESCE(oa.availability_status,'AVAILABLE') AS availability_status
     FROM officer_department_assignments oda
     JOIN users u ON u.id=oda.officer_user_id
     JOIN departments d ON d.id=oda.department_id
     LEFT JOIN staff_profiles sp ON sp.user_id=u.id
     LEFT JOIN department_heads dh ON dh.user_id=u.id
     LEFT JOIN officer_availability oa ON oa.officer_user_id=u.id
     WHERE oda.department_id=$1 AND oda.status='ACTIVE'
       AND oda.starts_at<=CURRENT_TIMESTAMP AND (oda.ends_at IS NULL OR oda.ends_at>CURRENT_TIMESTAMP)
       AND u.is_active=TRUE AND u.role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD')
       AND d.is_active=TRUE AND COALESCE(oa.availability_status,'AVAILABLE')='AVAILABLE'
       AND (oda.assignment_type='TEMPORARY' OR NOT EXISTS (
         SELECT 1 FROM officer_department_assignments transfer
         WHERE transfer.department_id=oda.department_id
           AND transfer.original_officer_user_id=oda.officer_user_id
           AND transfer.assignment_type='TEMPORARY' AND transfer.status='ACTIVE'
           AND transfer.starts_at<=CURRENT_TIMESTAMP
           AND (transfer.ends_at IS NULL OR transfer.ends_at>CURRENT_TIMESTAMP)
       ))
     ORDER BY oda.officer_user_id,oda.assignment_type DESC,oda.starts_at DESC`,
    [Number(departmentId)]
)).rows;

const chooseSupervisor = async (client, { departmentId, selectedOfficerId, currentOfficerId = null }) => {
    const officers = await availableSupervisors(client, departmentId);
    if (!officers.length) throw new CommunityServiceSessionError('No authorized officer is available. Contact the Discipline Office before recording attendance.', 409, 'NO_AVAILABLE_OFFICER');
    const selected = selectedOfficerId
        ? officers.find((item) => Number(item.officer_user_id) === Number(selectedOfficerId))
        : currentOfficerId
            ? officers.find((item) => Number(item.officer_user_id) === Number(currentOfficerId)) || (officers.length === 1 ? officers[0] : null)
            : officers.length === 1 ? officers[0] : null;
    if (!selectedOfficerId && !selected) throw new CommunityServiceSessionError('Select the authorized officer supervising this session.', 400, 'OFFICER_SELECTION_REQUIRED');
    if (!selected) throw new CommunityServiceSessionError('The selected supervising officer is not active, available, or authorized for this department.', 403, 'UNAUTHORIZED_OFFICER');
    if (currentOfficerId && Number(selected.officer_user_id) !== Number(currentOfficerId)
        && !(selected.assignment_type === 'TEMPORARY' && Number(selected.original_officer_user_id) === Number(currentOfficerId))) {
        throw new CommunityServiceSessionError('The supervising officer can change only through an active authorized transfer.', 409, 'OFFICER_TRANSFER_REQUIRED');
    }
    return selected;
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

const recordTimeIn = async ({ assignmentId, expectedStudentId, departmentId, supervisingOfficerId, actor, notes, ipAddress, writeQrLog = false }) => {
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

        const supervisor = await chooseSupervisor(client, { departmentId, selectedOfficerId: supervisingOfficerId });

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_IN", notes });
        const sessionResult = await client.query(
            `INSERT INTO community_service_sessions
                (assignment_id, department_id, supervising_officer_user_id, time_in_by_user_id, time_in_attendance_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [assignmentId, departmentId, supervisor.officer_user_id, actor.id, attendance.id, notes || null]
        );
        const session = sessionResult.rows[0];
        await client.query(
            `INSERT INTO community_service_session_officer_history
                (session_id,officer_user_id,officer_assignment_id,reason,changed_by_user_id)
             VALUES($1,$2,$3,'Selected for community-service time-in',$4)`,
            [session.id, supervisor.officer_user_id, supervisor.assignment_id, actor.id]
        );
        let scanLog = null;
        if (writeQrLog) {
            scanLog = (await client.query(
                `INSERT INTO qr_scan_logs
                    (student_id, scanned_by, department_id, scan_type, device_information, ip_address)
                 VALUES ($1, $2, $3, 'TIME_IN', $4, $5) RETURNING *`,
                [assignment.student_id, actor.id, departmentId, notes || null, ipAddress || null]
            )).rows[0];
        }
        await insertAudit({ client, actor, action: "TIME_IN", sessionId: session.id, assignmentId, description: { department_id: Number(departmentId), supervising_officer_user_id: Number(supervisor.officer_user_id) }, ipAddress });
        await notifyStudent(client, assignment.student_id, {
            title: 'Community service time-in recorded',
            message: `Time-in was recorded for assignment #${assignment.id}.`,
            type: 'SERVICE_TIME_IN',
            eventKey: `service-session:${session.id}:time-in`
        });
        await notifyAttendanceStaff(client, { studentId:assignment.student_id, departmentId, supervisorId:supervisor.officer_user_id, sessionId:session.id, action:'TIME_IN', occurredAt:session.time_in });
        await client.query("COMMIT");
        return { assignment, attendance, session, supervising_officer: supervisor, scanLog };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        if (error.code === "23505" && error.constraint === "uq_community_service_active_session") {
            throw new CommunityServiceSessionError("Assignment already has an active community service session", 409, "ACTIVE_SESSION_EXISTS");
        }
        throw error;
    } finally { client.release(); }
};

const CONDITIONS = new Set(['SATISFACTORY', 'NEEDS_FOLLOW_UP', 'INCIDENT_REPORTED']);

const calculateSessionCredit = ({ requiredHours, completedHours, workedMinutes }) => {
    const requiredMinutes = Math.max(0, Math.round(Number(requiredHours || 0) * 60));
    const previousMinutes = Math.max(0, Math.round(Number(completedHours || 0) * 60));
    const safeWorkedMinutes = Math.max(0, Math.floor(Number(workedMinutes || 0)));
    const creditedMinutes = Math.min(safeWorkedMinutes, Math.max(requiredMinutes - previousMinutes, 0));
    const newMinutes = previousMinutes + creditedMinutes;
    return { requiredMinutes, previousMinutes, creditedMinutes, newMinutes, remainingMinutes: Math.max(requiredMinutes - newMinutes, 0) };
};

const recordTimeOut = async ({ assignmentId, expectedStudentId, departmentId, supervisingOfficerId, actor, notes, condition, ipAddress, writeQrLog = false }) => {
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
        const supervisor = await chooseSupervisor(client, { departmentId, selectedOfficerId: supervisingOfficerId, currentOfficerId: session.supervising_officer_user_id });
        const supervisorChanged = Number(supervisor.officer_user_id) !== Number(session.supervising_officer_user_id);
        if (supervisorChanged) {
            await client.query(`UPDATE community_service_session_officer_history SET ends_at=CURRENT_TIMESTAMP WHERE session_id=$1 AND ends_at IS NULL`, [session.id]);
            await client.query(
                `INSERT INTO community_service_session_officer_history
                    (session_id,officer_user_id,officer_assignment_id,reason,changed_by_user_id)
                 VALUES($1,$2,$3,'Authorized responsibility transfer during active session',$4)`,
                [session.id, supervisor.officer_user_id, supervisor.assignment_id, actor.id]
            );
        }

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_OUT", notes });
        const duration = (await client.query(
            `SELECT GREATEST(FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - $1::timestamptz)) / 60), 0)::int AS minutes`,
            [session.time_in]
        )).rows[0].minutes;
        const normalizedCondition = String(condition || '').toUpperCase();
        if (!CONDITIONS.has(normalizedCondition)) throw new CommunityServiceSessionError('Select the student service condition before time-out', 400);

        const { requiredMinutes, previousMinutes, creditedMinutes, newMinutes, remainingMinutes } = calculateSessionCredit({
            requiredHours: assignment.required_hours,
            completedHours: assignment.completed_hours,
            workedMinutes: duration
        });

        const completedSession = (await client.query(
            `UPDATE community_service_sessions
             SET time_out = CURRENT_TIMESTAMP, worked_minutes = $1, credited_minutes = $7,
                 status = 'COMPLETED', time_out_by_user_id = $2,
                 time_out_supervising_officer_user_id = $8,
                 time_out_attendance_id = $3, service_condition = $5,
                 result_notes = $6, review_status = 'APPROVED',
                 reviewed_by_user_id = $2, reviewed_at = CURRENT_TIMESTAMP,
                 review_notes = 'Automatically credited at department time-out',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND time_out IS NULL RETURNING *`,
            [duration, actor.id, attendance.id, session.id, normalizedCondition, notes || null, creditedMinutes, supervisor.officer_user_id]
        )).rows[0];
        if (!completedSession) throw new CommunityServiceSessionError("Community service session was already completed", 409);

        await client.query(
            `INSERT INTO community_service_progress_history
                (assignment_id,session_id,previous_completed_minutes,worked_minutes,credited_minutes,new_completed_minutes,performed_by_user_id)
             VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [assignment.id, session.id, previousMinutes, duration, creditedMinutes, newMinutes, actor.id]
        );
        const assignmentStatus = remainingMinutes === 0 ? 'COMPLETED' : 'IN_PROGRESS';
        const updatedAssignment = (await client.query(
            `UPDATE community_service_assignments
             SET completed_hours=$1,remaining_hours=$2,status=$3::violation_status,
                 completed_at=CASE WHEN $3::text='COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id=$4 RETURNING *`,
            [newMinutes / 60, remainingMinutes / 60, assignmentStatus, assignment.id]
        )).rows[0];
        let violation = (await client.query(
            'UPDATE violations SET completed_service_hours=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',
            [newMinutes / 60, assignment.violation_id]
        )).rows[0];
        let clearanceSync = null;
        if (assignmentStatus === 'COMPLETED' && violation.status === 'OPEN') {
            const transition = await transitionViolationWithClient({ client, violationId: assignment.violation_id, action: 'COMPLETE', reason: null, actor, ipAddress });
            violation = transition.violation;
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
        await client.query(`UPDATE community_service_session_officer_history SET ends_at=CURRENT_TIMESTAMP WHERE session_id=$1 AND ends_at IS NULL`, [session.id]);
        await insertAudit({ client, actor, action: "TIME_OUT_CREDITED", sessionId: session.id, assignmentId, description: { worked_minutes: Number(duration), credited_minutes: creditedMinutes, service_condition: normalizedCondition, supervising_officer_user_id: Number(supervisor.officer_user_id), supervisor_changed: supervisorChanged }, ipAddress });
        await notifyStudent(client, assignment.student_id, {
            title: assignmentStatus === 'COMPLETED' ? 'Community service completed' : 'Community service time-out recorded',
            message: `${creditedMinutes} service minute${creditedMinutes === 1 ? '' : 's'} credited at department time-out.`,
            type: assignmentStatus === 'COMPLETED' ? 'SERVICE_COMPLETED' : 'SERVICE_TIME_OUT',
            eventKey: `service-session:${session.id}:time-out`
        });
        await notifyAttendanceStaff(client, { studentId:assignment.student_id, departmentId, supervisorId:supervisor.officer_user_id, sessionId:session.id, action:'TIME_OUT', occurredAt:completedSession.time_out });
        await client.query("COMMIT");
        return { assignment: updatedAssignment, attendance, session: completedSession, supervising_officer: supervisor, violation, clearanceSync, scanLog };
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

module.exports = { CommunityServiceSessionError, recordTimeIn, recordTimeOut, reviewServiceResult, calculateSessionCredit, availableSupervisors, chooseSupervisor, CONDITIONS };
