const pool = require("../config/database");
const { transitionViolationWithClient } = require("./violationWorkflowService");
const { notifyStudent, notifyAttendanceStaff } = require('./notificationService');
const { serviceDate, serviceAllowance, validateDuration, sessionTiming, calculateCredit } = require('./communityServiceTiming');

const dailyCredit = async (client, studentId, date, excludedSessionId = null) => Number((await client.query(
    `SELECT COALESCE(SUM(credited_minutes),0) AS minutes FROM community_service_sessions
     WHERE student_id=$1 AND service_date=$2 AND time_out IS NOT NULL AND id IS DISTINCT FROM $3::bigint`,
    [studentId, date, excludedSessionId]
)).rows[0].minutes);

const lockStudent = async (client, assignmentId) => {
    const student = (await client.query(`SELECT s.id,u.is_active FROM students s
        JOIN users u ON u.id=s.user_id JOIN community_service_assignments a ON a.student_id=s.id
        WHERE a.id=$1 FOR UPDATE OF s`, [assignmentId])).rows[0];
    if (!student) throw new CommunityServiceSessionError('Community service assignment not found', 404);
    if (!student.is_active) throw new CommunityServiceSessionError('This student account is inactive', 400);
    return student;
};

// One clock and one grouped daily-credit read for an entire list of sessions.
const hydrateSessions = async (client, sessions) => {
    if (!sessions.length) return [];
    const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
    const totals = (await client.query(`SELECT student_id,service_date::text,COALESCE(SUM(credited_minutes),0) AS minutes
        FROM community_service_sessions WHERE student_id=ANY($1::bigint[]) AND time_out IS NOT NULL
        GROUP BY student_id,service_date`, [[...new Set(sessions.map(s => s.student_id))]])).rows;
    const byDay = new Map(totals.map(row => [`${row.student_id}:${row.service_date}`, Number(row.minutes)]));
    return sessions.map(session => {
        const date = session.service_date instanceof Date ? serviceDate(session.time_in) : String(session.service_date).slice(0,10);
        if (session.time_out) {
            if (!session.session_type) return {...session,server_time:new Date(now).toISOString()};
            const cutoffHours = Math.max(0,(new Date(session.credit_cutoff_at)-new Date(session.time_in))/3600000);
            return {...session,...sessionTiming(session,{remaining_hours:cutoffHours},0,now),
                completed_today_minutes:byDay.get(`${session.student_id}:${date}`)||0,
                daily_remaining_seconds:Math.max(0,(480-(byDay.get(`${session.student_id}:${date}`)||0))*60)};
        }
        return { ...session, ...sessionTiming(session, session, byDay.get(`${session.student_id}:${date}`) || 0, now) };
    });
};

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

const recheckRecorder = async (client, actor, departmentId) => {
    const current = (await client.query(`SELECT u.id,u.role,u.is_active,u.session_version,
        COALESCE(dh.department_id,sp.department_id) AS department_id
        FROM users u LEFT JOIN department_heads dh ON dh.user_id=u.id
        LEFT JOIN staff_profiles sp ON sp.user_id=u.id WHERE u.id=$1`,[actor.id])).rows[0];
    if (!current?.is_active || current.role !== actor.role || !['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE','DEPARTMENT_HEAD'].includes(current.role)
        || (actor.session_version != null && Number(current.session_version)!==Number(actor.session_version))) {
        throw new CommunityServiceSessionError('Recorder authorization has changed. Sign in again.',403,'RECORDER_NOT_AUTHORIZED');
    }
    let allowed = false, status = 403, message = 'Department authorization has changed';
    const response = { status(value) { status=value; return this; }, json(body) { message=body.message; } };
    await require('../middleware/authMiddleware').requireAuthorizedDepartment({user:current,body:{department_id:departmentId}},response,()=>{allowed=true;},client);
    if (!allowed) throw new CommunityServiceSessionError(message,status,'RECORDER_NOT_AUTHORIZED');
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
       AND oda.starts_at<=clock_timestamp() AND (oda.ends_at IS NULL OR oda.ends_at>clock_timestamp())
       AND u.is_active=TRUE AND u.role IN ('DISCIPLINE_OFFICE','DEPARTMENT_HEAD')
       AND d.is_active=TRUE AND COALESCE(oa.availability_status,'AVAILABLE')='AVAILABLE'
       AND (oda.assignment_type='TEMPORARY' OR NOT EXISTS (
         SELECT 1 FROM officer_department_assignments transfer
         WHERE transfer.department_id=oda.department_id
           AND transfer.original_officer_user_id=oda.officer_user_id
           AND transfer.assignment_type='TEMPORARY' AND transfer.status='ACTIVE'
           AND transfer.starts_at<=clock_timestamp()
           AND (transfer.ends_at IS NULL OR transfer.ends_at>clock_timestamp())
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
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address, actor_role)
         VALUES ($1, $2, 'community_service_sessions', $3, $4, $5, $6)`,
        [actor.id, action, sessionId, JSON.stringify({ assignment_id: Number(assignmentId), ...description }), ipAddress || null, actor.role]
    );

const recordTimeIn = async ({ assignmentId, expectedStudentId, departmentId, supervisingOfficerId, sessionType, selectedDurationMinutes, actor, notes, ipAddress, writeQrLog = false }) => {
    if (notes != null && (typeof notes !== 'string' || notes.length > 500)) throw new CommunityServiceSessionError('Notes must be at most 500 characters', 400);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await lockStudent(client, assignmentId);
        const assignment = await loadAssignment(client, assignmentId, true);
        await recheckRecorder(client, actor, assignment.department_id);
        validateEligible(assignment, expectedStudentId, departmentId);

        const active = await client.query(
            `SELECT id, time_in FROM community_service_sessions
             WHERE student_id = $1 AND time_out IS NULL`,
            [assignment.student_id]
        );
        if (active.rows.length) throw new CommunityServiceSessionError("Student already has an active community service session", 409, "ACTIVE_SESSION_EXISTS");

        const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        const completedToday = await dailyCredit(client, assignment.student_id, serviceDate(now));
        const allowance = serviceAllowance(assignment, completedToday, now);
        const selection = validateDuration(sessionType, selectedDurationMinutes, allowance.available_minutes, Number(assignment.remaining_hours) * 60);
        const cutoff = new Date(Math.ceil(new Date(now).getTime() + allowance.available_minutes * 60000));

        const supervisor = await chooseSupervisor(client, { departmentId, selectedOfficerId: supervisingOfficerId });

        const attendance = await insertAttendance({ client, assignment, departmentId, actorId: actor.id, type: "TIME_IN", notes });
        const sessionResult = await client.query(
            `INSERT INTO community_service_sessions
                (assignment_id, department_id, supervising_officer_user_id, time_in_by_user_id, time_in_attendance_id, notes,
                 student_id,session_type,selected_duration_minutes,service_date,credit_cutoff_at,time_in_role,time_in)
             VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [assignmentId, departmentId, supervisor.officer_user_id, actor.id, attendance.id, notes || null,
                assignment.student_id,selection.session_type,selection.selected_duration_minutes,allowance.service_date,cutoff,actor.role,now]
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
        return { assignment, attendance, session: { ...session, ...sessionTiming(session, assignment, completedToday, now) }, allowance, supervising_officer: supervisor, scanLog };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        if (error.code === "23505" && ['uq_community_service_active_session','uq_service_active_student'].includes(error.constraint)) {
            throw new CommunityServiceSessionError("Student already has an active community service session", 409, "ACTIVE_SESSION_EXISTS");
        }
        throw error;
    } finally { client.release(); }
};

const ATTENDANCE_OUTCOMES = new Set(['TODAYS_SERVICE_COMPLETED', 'LEFT_EARLY', 'SERVICE_COMPLETED']);

const validateAttendanceOutcome = ({ attendanceOutcome, remainingMinutes }) => {
    const normalizedOutcome = String(attendanceOutcome || '').toUpperCase();
    if (!ATTENDANCE_OUTCOMES.has(normalizedOutcome)) {
        throw new CommunityServiceSessionError('Select an attendance outcome before time-out', 400, 'ATTENDANCE_OUTCOME_REQUIRED');
    }
    const completesService = Number(remainingMinutes) === 0;
    if (completesService && normalizedOutcome !== 'SERVICE_COMPLETED') {
        throw new CommunityServiceSessionError('Select Service Completed because this session fulfills all required community-service hours', 400, 'ATTENDANCE_OUTCOME_MISMATCH');
    }
    if (!completesService && normalizedOutcome === 'SERVICE_COMPLETED') {
        throw new CommunityServiceSessionError("Select Today’s Service Completed or Left Early because required community-service hours remain", 400, 'ATTENDANCE_OUTCOME_MISMATCH');
    }
    return normalizedOutcome;
};

const calculateSessionCredit = ({ requiredHours, completedHours, workedMinutes }) => {
    const requiredMinutes = Math.max(0, Math.round(Number(requiredHours || 0) * 60));
    const previousMinutes = Math.max(0, Math.round(Number(completedHours || 0) * 60));
    const safeWorkedMinutes = Math.max(0, Math.floor(Number(workedMinutes || 0)));
    const creditedMinutes = Math.min(safeWorkedMinutes, Math.max(requiredMinutes - previousMinutes, 0));
    const newMinutes = previousMinutes + creditedMinutes;
    return { requiredMinutes, previousMinutes, creditedMinutes, newMinutes, remainingMinutes: Math.max(requiredMinutes - newMinutes, 0) };
};

const calculateSessionWork = ({ requiredHours, completedHours, elapsedMinutes }) => {
    const requiredMinutes = Math.max(0, Math.round(Number(requiredHours || 0) * 60));
    const previousMinutes = Math.max(0, Math.round(Number(completedHours || 0) * 60));
    const timerLimitMinutes = Math.max(requiredMinutes - previousMinutes, 0);
    const actualElapsedMinutes = Math.max(0, Math.floor(Number(elapsedMinutes || 0)));
    return {
        actualElapsedMinutes,
        timerLimitMinutes,
        workedMinutes: Math.min(actualElapsedMinutes, timerLimitMinutes),
        limitReached: actualElapsedMinutes >= timerLimitMinutes
    };
};

const recordTimeOut = async ({ assignmentId, sessionId, expectedStudentId, departmentId, supervisingOfficerId, actor, notes, ipAddress, writeQrLog = false }) => {
    if (notes != null && (typeof notes !== 'string' || notes.length > 500)) throw new CommunityServiceSessionError('Notes must be at most 500 characters', 400);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (!/^\d+$/.test(String(sessionId || '')) || Number(sessionId) < 1) throw new CommunityServiceSessionError('A valid session_id is required for Time Out', 400);
        await lockStudent(client, assignmentId);
        const assignment = await loadAssignment(client, assignmentId, true);
        await recheckRecorder(client, actor, assignment.department_id);
        const sessionResult = await client.query(
            `SELECT * FROM community_service_sessions
             WHERE assignment_id = $1 AND id=$2
             FOR UPDATE`, [assignmentId,sessionId]
        );
        if (!sessionResult.rows.length) throw new CommunityServiceSessionError("No active community service session found", 409, "NO_ACTIVE_SESSION");
        const session = sessionResult.rows[0];
        if (Number(session.department_id) !== Number(departmentId)) throw new CommunityServiceSessionError("No active community service session found", 409, "NO_ACTIVE_SESSION");
        if (expectedStudentId && Number(assignment.student_id) !== Number(expectedStudentId)) throw new CommunityServiceSessionError('The session does not belong to this student', 400);
        if (session.time_out) {
            await client.query('COMMIT');
            return { assignment, session, attendance_outcome: session.service_condition, already_completed: true };
        }
        validateEligible(assignment, expectedStudentId, departmentId);
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
        const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        const completedToday = await dailyCredit(client, assignment.student_id, serviceDate(session.time_in), session.id);
        const credit = calculateCredit(session, assignment, completedToday, now);
        const { previousMinutes, creditedMinutes, newMinutes, remainingMinutes } = credit;
        const duration = credit.workedMinutes;
        const normalizedOutcome = credit.attendanceOutcome;

        const completedSession = (await client.query(
            `UPDATE community_service_sessions
             SET time_out = $9, worked_minutes = $1, credited_minutes = $7,
                 status = 'COMPLETED', time_out_by_user_id = $2,
                 time_out_supervising_officer_user_id = $8,
                 time_out_attendance_id = $3, service_condition = $5,
                 result_notes = $6, review_status = 'APPROVED',
                 reviewed_by_user_id = $2, reviewed_at = CURRENT_TIMESTAMP,
                 review_notes = 'Automatically credited at department time-out',
                 updated_at = CURRENT_TIMESTAMP,completion_reason=$10,time_out_role=$11
             WHERE id = $4 AND time_out IS NULL RETURNING *`,
            [duration, actor.id, attendance.id, session.id, normalizedOutcome, notes || null, creditedMinutes, supervisor.officer_user_id,now,credit.completionReason,actor.role]
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
             SET completed_hours=LEAST(ROUND($1::numeric,6),required_hours),remaining_hours=GREATEST(required_hours-LEAST(ROUND($1::numeric,6),required_hours),0),status=$2::violation_status,
                 completed_at=CASE WHEN $2::text='COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id=$3 RETURNING *`,
            [newMinutes / 60, assignmentStatus, assignment.id]
        )).rows[0];
        let violation = (await client.query(
            'UPDATE violations SET completed_service_hours=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',
            [updatedAssignment.completed_hours, assignment.violation_id]
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
        await insertAudit({ client, actor, action: "TIME_OUT_CREDITED", sessionId: session.id, assignmentId, description: { actual_elapsed_minutes: duration, credited_minutes: creditedMinutes, completion_reason:credit.completionReason, attendance_outcome: normalizedOutcome, actor_role:actor.role, supervising_officer_user_id: Number(supervisor.officer_user_id), supervisor_changed: supervisorChanged }, ipAddress });
        await notifyStudent(client, assignment.student_id, {
            title: assignmentStatus === 'COMPLETED' ? 'Community service completed' : 'Community service time-out recorded',
            message: `${creditedMinutes} service minute${creditedMinutes === 1 ? '' : 's'} credited at department time-out.`,
            type: assignmentStatus === 'COMPLETED' ? 'SERVICE_COMPLETED' : 'SERVICE_TIME_OUT',
            eventKey: `service-session:${session.id}:time-out`
        });
        await notifyAttendanceStaff(client, { studentId:assignment.student_id, departmentId, supervisorId:supervisor.officer_user_id, sessionId:session.id, action:'TIME_OUT', occurredAt:completedSession.time_out });
        await client.query("COMMIT");
        return { assignment: updatedAssignment, assignment_status: assignmentStatus, attendance_outcome: normalizedOutcome, attendance, session: { ...completedSession, attendance_outcome: normalizedOutcome }, supervising_officer: supervisor, violation, clearanceSync, scanLog };
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
        const identity = (await client.query('SELECT assignment_id FROM community_service_sessions WHERE id=$1',[sessionId])).rows[0];
        if (!identity) throw new CommunityServiceSessionError('Service result not found',404);
        await lockStudent(client, identity.assignment_id);
        const session = (await client.query(`SELECT css.*,a.student_id,a.violation_id,a.required_hours,a.completed_hours,a.status AS assignment_status,v.status AS violation_status FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN violations v ON v.id=a.violation_id WHERE css.id=$1 FOR UPDATE OF css,a`,[Number(sessionId)])).rows[0];
        if(!session) throw new CommunityServiceSessionError('Service result not found',404);
        if(session.review_status!=='PENDING') throw new CommunityServiceSessionError('Service result was already reviewed',409);
        await recheckRecorder(client,actor,session.department_id);
        if(normalizedDecision==='REJECT'){
            const rejected=(await client.query(`UPDATE community_service_sessions SET review_status='REJECTED',reviewed_by_user_id=$2,reviewed_at=CURRENT_TIMESTAMP,review_notes=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,[session.id,actor.id,String(reviewNotes).trim()])).rows[0];
            await insertAudit({client,actor,action:'SERVICE_RESULT_REJECT',sessionId:session.id,assignmentId:session.assignment_id,description:{reason:String(reviewNotes).trim()},ipAddress});
            await notifyStudent(client,session.student_id,{title:'Community service result needs follow-up',message:'The Discipline Office did not credit the submitted service session. Contact the Discipline Office for guidance.',type:'SERVICE_RESULT_REJECTED',eventKey:`service-session:${session.id}:rejected`});
            await client.query('COMMIT');return{session:rejected};
        }
        if (session.violation_status !== 'OPEN' || !['OPEN', 'IN_PROGRESS', 'COMPLETED'].includes(session.assignment_status)) throw new CommunityServiceSessionError('Reopen the violation before approving service credit', 409);
        const active = await client.query('SELECT id FROM community_service_sessions WHERE assignment_id=$1 AND time_out IS NULL',[session.assignment_id]);
        if (active.rows.length) throw new CommunityServiceSessionError('Time out the active session before approving legacy credit for this assignment',409,'ACTIVE_SESSION_EXISTS');
        const completedToday = await dailyCredit(client, session.student_id, serviceDate(session.time_in), session.id);
        const legacy = { ...session, session_type: session.session_type || 'OPEN_TIME', credit_cutoff_at:new Date(Math.min(
            new Date(session.credit_cutoff_at || `${serviceDate(session.time_in)}T00:00:00+08:00`).getTime() + (session.credit_cutoff_at ? 0 : 86400000),
            new Date(session.time_in).getTime()+Number(session.worked_minutes)*60000)).toISOString() };
        const credit = calculateCredit(legacy,session,completedToday,session.time_out);
        const { creditedMinutes, previousMinutes, newMinutes } = credit;
        const approved=(await client.query(`UPDATE community_service_sessions SET credited_minutes=$2,review_status='APPROVED',reviewed_by_user_id=$3,reviewed_at=CURRENT_TIMESTAMP,review_notes=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,[session.id,creditedMinutes,actor.id,String(reviewNotes).trim()])).rows[0];
        await client.query(`INSERT INTO community_service_progress_history(assignment_id,session_id,previous_completed_minutes,worked_minutes,credited_minutes,new_completed_minutes,performed_by_user_id)VALUES($1,$2,$3,$4,$5,$6,$7)`,[session.assignment_id,session.id,previousMinutes,session.worked_minutes,creditedMinutes,newMinutes,actor.id]);
        const remainingMinutes=credit.remainingMinutes,status=remainingMinutes===0?'COMPLETED':'IN_PROGRESS';
        const assignment=(await client.query(`UPDATE community_service_assignments SET completed_hours=$1,remaining_hours=$2,status=$3::violation_status,completed_at=CASE WHEN $3::text='COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=$4 RETURNING *`,[newMinutes/60,remainingMinutes/60,status,session.assignment_id])).rows[0];
        let violation=(await client.query('UPDATE violations SET completed_service_hours=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',[newMinutes/60,session.violation_id])).rows[0],clearanceSync=null;
        if(status==='COMPLETED'&&violation.status==='OPEN'){const transition=await transitionViolationWithClient({client,violationId:session.violation_id,action:'COMPLETE',reason:null,actor,ipAddress});violation=transition.violation;clearanceSync=transition.clearanceSync;}
        await insertAudit({client,actor,action:'SERVICE_RESULT_APPROVE',sessionId:session.id,assignmentId:session.assignment_id,description:{worked_minutes:Number(session.worked_minutes),credited_minutes:creditedMinutes},ipAddress});
        await notifyStudent(client,session.student_id,{title:status==='COMPLETED'?'Community service completed':'Community service result approved',message:`${creditedMinutes} service minute${creditedMinutes===1?'':'s'} approved by the Discipline Office.`,type:status==='COMPLETED'?'SERVICE_COMPLETED':'SERVICE_RESULT_APPROVED',eventKey:`service-session:${session.id}:approved`});
        await client.query('COMMIT');return{session:approved,assignment,violation,clearanceSync};
    }catch(error){try{await client.query('ROLLBACK')}catch(_){}throw error}finally{client.release()}
};

const previewTimeOut = async ({ sessionId, departmentId }) => {
    const session = (await pool.query(`SELECT css.*,a.required_hours,a.completed_hours,a.remaining_hours,
        s.first_name,s.last_name,s.student_number,d.department_name
        FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id
        JOIN students s ON s.id=css.student_id JOIN departments d ON d.id=css.department_id
        WHERE css.id=$1 AND css.department_id=$2`,[sessionId,departmentId])).rows[0];
    if (!session) throw new CommunityServiceSessionError('Service session not found',404);
    const now = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (session.time_out) return {session,already_completed:true,server_time:now,available_officers:[],preview:{
        server_time:new Date(now).toISOString(),workedMinutes:Number(session.worked_minutes),creditedMinutes:Number(session.credited_minutes),completionReason:session.completion_reason||'COMPLETED'}};
    const completedToday = await dailyCredit(pool,session.student_id,serviceDate(session.time_in),session.id);
    const officers = (await availableSupervisors(pool, session.department_id)).filter(officer =>
        Number(officer.officer_user_id) === Number(session.supervising_officer_user_id)
        || (officer.assignment_type === 'TEMPORARY' && Number(officer.original_officer_user_id) === Number(session.supervising_officer_user_id)));
    return { session, preview:calculateCredit(session,session,completedToday,now), server_time:now, available_officers:officers };
};

module.exports = { CommunityServiceSessionError, recordTimeIn, recordTimeOut, reviewServiceResult, calculateSessionCredit, calculateSessionWork, validateAttendanceOutcome, availableSupervisors, chooseSupervisor, ATTENDANCE_OUTCOMES, dailyCredit, hydrateSessions, previewTimeOut };
