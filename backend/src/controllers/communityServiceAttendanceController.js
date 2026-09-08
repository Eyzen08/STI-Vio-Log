const pool = require("../config/database");
const { CommunityServiceSessionError, recordTimeIn, recordTimeOut, reviewServiceResult } = require("../services/communityServiceSessionService");
const { sendError: sendApiError } = require("../utils/api");
const { assertAllowedFields } = require("../utils/validators");
const { emitAttendanceChange } = require('../services/realtimeEventService');
const { emitNotificationChange } = require('../services/realtimeEventService');
const { notifyAttendanceFailure } = require('../services/notificationService');

const rejectionCodes = new Set(['ACTIVE_SESSION_EXISTS', 'NO_ACTIVE_SESSION', 'NO_AVAILABLE_OFFICER', 'OFFICER_SELECTION_REQUIRED', 'UNAUTHORIZED_OFFICER', 'OFFICER_TRANSFER_REQUIRED']);
const recordFailureNotice = async (req, action, error) => {
    if (!rejectionCodes.has(error.code) || !req.body?.student_id || !req.staffDepartmentId) return;
    try {
        await notifyAttendanceFailure(pool, { studentId:req.body.student_id, departmentId:req.staffDepartmentId, supervisorId:req.body.supervising_officer_id, action, status:error.code });
        emitNotificationChange(req.staffDepartmentId, { action, status:'REJECTED' });
    } catch (notificationError) { console.error('Attendance failure notification error:', notificationError.message); }
};

const sendError = (res, error, operation) => {
    console.error(`${operation} error:`, error);
    const status = error.statusCode || 500;
    return sendApiError(res, status, error.code || (status === 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR"), status === 500 ? `Failed to ${operation}` : error.message);
};

const communityServiceTimeIn = async (req, res) => {
    try {
        const allowedFields = req.user.role === "DEPARTMENT_HEAD"
            ? ["assignment_id", "student_id", "notes", "supervising_officer_id"]
            : ["assignment_id", "student_id", "notes", "department_id", "supervising_officer_id"];
        assertAllowedFields(req.body, allowedFields);
        const { assignment_id, student_id, notes } = req.body;
        if (!assignment_id || !student_id || !req.staffDepartmentId) return res.status(400).json({ success: false, message: "assignment_id, student_id, and a valid staff department are required" });
        const result = await recordTimeIn({ assignmentId: assignment_id, expectedStudentId: student_id, departmentId: req.staffDepartmentId, supervisingOfficerId: req.body.supervising_officer_id, actor: req.user, notes, ipAddress: req.ip });
        await emitAttendanceChange(result, req.staffDepartmentId);
        return res.status(201).json({ success: true, message: "Community service time-in recorded successfully", ...result });
    } catch (error) { await recordFailureNotice(req, 'TIME_IN_REJECTED', error); return sendError(res, error, "record community service time-in"); }
};

const communityServiceTimeOut = async (req, res) => {
    try {
        const allowedFields = req.user.role === "DEPARTMENT_HEAD"
            ? ["assignment_id", "student_id", "notes", "condition", "supervising_officer_id"]
            : ["assignment_id", "student_id", "notes", "condition", "department_id", "supervising_officer_id"];
        assertAllowedFields(req.body, allowedFields);
        const { assignment_id, student_id, notes, condition } = req.body;
        if (!assignment_id || !student_id || !req.staffDepartmentId) return res.status(400).json({ success: false, message: "assignment_id, student_id, and a valid staff department are required" });
        const result = await recordTimeOut({ assignmentId: assignment_id, expectedStudentId: student_id, departmentId: req.staffDepartmentId, supervisingOfficerId: req.body.supervising_officer_id, actor: req.user, notes, condition, ipAddress: req.ip });
        await emitAttendanceChange(result, req.staffDepartmentId);
        return res.status(201).json({ success: true, message: "Community service time-out recorded successfully", hours_worked: result.session.worked_minutes / 60, ...result });
    } catch (error) { await recordFailureNotice(req, 'TIME_OUT_REJECTED', error); return sendError(res, error, "record community service time-out"); }
};

const reviewCommunityServiceResult = async (req,res) => {
    try {
        assertAllowedFields(req.body,['decision','review_notes']);
        const result=await reviewServiceResult({sessionId:req.params.sessionId,decision:req.body?.decision,reviewNotes:req.body?.review_notes,actor:req.user,ipAddress:req.ip});
        return res.json({success:true,message:req.body.decision==='APPROVE'?'Service result approved and credited':'Service result rejected without credit',...result});
    } catch(error){return sendError(res,error,'review community service result')}
};

const getPendingServiceResults = async (_req,res) => {
    try {
        const result=await pool.query(`SELECT css.*,a.required_hours,a.completed_hours,a.remaining_hours,s.student_number,s.first_name,s.last_name,d.department_name FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN students s ON s.id=a.student_id JOIN departments d ON d.id=css.department_id WHERE css.status='COMPLETED' AND css.review_status='PENDING' ORDER BY css.time_out ASC,css.id ASC`);
        return res.json({success:true,results:result.rows});
    } catch(error){return sendError(res,error,'get pending service results')}
};

const getActiveDepartmentSessions = async (req, res) => {
    try {
        const query = req.query || {};
        assertAllowedFields(query, ['department_id']);
        const role = req.user?.role || 'DEPARTMENT_HEAD';
        const scopedDepartment = role === 'ADMIN'
            ? (query.department_id ? Number(query.department_id) : null)
            : Number(req.staffDepartmentId || req.user?.department_id);
        if (query.department_id && (!Number.isInteger(Number(query.department_id)) || Number(query.department_id) <= 0)) return res.status(400).json({ success: false, message: 'A valid department_id is required' });
        if (role !== 'ADMIN' && !scopedDepartment) return res.status(403).json({ success: false, message: 'No authorized department is assigned to this account' });
        const departmentWhere = scopedDepartment ? 'css.department_id=$1 AND a.department_id=$1' : '$1::bigint IS NULL';
        const result = await pool.query(
            `SELECT css.id AS session_id, css.assignment_id, css.time_in, css.notes,
                    FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - css.time_in)))::int AS elapsed_seconds,
                    CURRENT_TIMESTAMP AS server_time,
                    a.student_id, a.required_hours, a.completed_hours, a.remaining_hours,
                    s.student_number, s.first_name, s.last_name,d.department_name,
                    css.supervising_officer_user_id,
                    COALESCE(sp.first_name,dh.first_name) AS supervising_officer_first_name,
                    COALESCE(sp.last_name,dh.last_name) AS supervising_officer_last_name,
                    supervisor.role AS supervising_officer_role
             FROM community_service_sessions css
             JOIN community_service_assignments a ON a.id=css.assignment_id
             JOIN students s ON s.id=a.student_id
             JOIN departments d ON d.id=css.department_id
             JOIN users supervisor ON supervisor.id=css.supervising_officer_user_id
             LEFT JOIN staff_profiles sp ON sp.user_id=supervisor.id
             LEFT JOIN department_heads dh ON dh.user_id=supervisor.id
             WHERE ${departmentWhere}
               AND css.time_out IS NULL AND css.status='ACTIVE'
               AND a.status IN ('OPEN','IN_PROGRESS')
             ORDER BY css.time_in ASC, css.id ASC`,
            [scopedDepartment]
        );
        return res.json({ success: true, server_time: new Date().toISOString(), sessions: result.rows });
    } catch (error) { return sendError(res, error, "get active department sessions"); }
};

const parseDateFilters = (query) => {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = query;
    for (const [name, value] of [["from", from], ["to", to]]) {
        const parsed = value && pattern.test(value) ? new Date(`${value}T00:00:00Z`) : null;
        if (value && (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)) throw new CommunityServiceSessionError(`${name} must be a valid ISO date (YYYY-MM-DD)`, 400);
    }
    if (from && to && from > to) throw new CommunityServiceSessionError("from must be on or before to", 400);
    return { from, to };
};

const getCommunityServiceSessions = async (req, res) => {
    try {
        const { from, to } = parseDateFilters(req.query);
        const requestedDepartment = req.query.department_id;
        const effectiveDepartment = req.user.role === "DEPARTMENT_HEAD" ? req.user.department_id : requestedDepartment;
        if (req.user.role === "DEPARTMENT_HEAD" && requestedDepartment && Number(requestedDepartment) !== Number(req.user.department_id)) return res.status(403).json({ success: false, message: "Department Heads can only access their own department" });
        const params = [req.params.assignmentId];
        let filters = "";
        if (effectiveDepartment) {
            params.push(effectiveDepartment);
            filters += ` AND css.department_id = $${params.length}`;
            if (req.user.role === "DEPARTMENT_HEAD") filters += ` AND a.department_id = $${params.length}`;
        }
        if (from) { params.push(from); filters += ` AND css.time_in >= ($${params.length}::date::timestamp AT TIME ZONE 'UTC')`; }
        if (to) { params.push(to); filters += ` AND css.time_in < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'UTC')`; }
        const result = await pool.query(
            `SELECT css.*, d.department_name, a.student_id, a.violation_id,
                    a.required_hours, a.completed_hours, a.remaining_hours,
                    s.student_number, s.first_name, s.last_name,
                    COALESCE(sp.first_name,dh.first_name) AS supervising_officer_first_name,
                    COALESCE(sp.last_name,dh.last_name) AS supervising_officer_last_name,
                    supervisor.role AS supervising_officer_role
             FROM community_service_sessions css
             JOIN community_service_assignments a ON a.id = css.assignment_id
             JOIN students s ON s.id = a.student_id JOIN departments d ON d.id = css.department_id
             JOIN users supervisor ON supervisor.id=css.supervising_officer_user_id
             LEFT JOIN staff_profiles sp ON sp.user_id=supervisor.id
             LEFT JOIN department_heads dh ON dh.user_id=supervisor.id
             WHERE css.assignment_id = $1${filters}
             ORDER BY css.time_in DESC, css.id DESC`, params);
        return res.json({ success: true, assignment_id: Number(req.params.assignmentId), total_sessions: result.rows.length, sessions: result.rows });
    } catch (error) { return sendError(res, error, "get community service sessions"); }
};

const getCommunityServiceAttendance = async (req, res) => {
    try {
        const departmentScoped = req.user.role === 'DEPARTMENT_HEAD';
        const result = await pool.query(
            `SELECT csa.*, s.student_number, s.first_name, s.last_name, d.department_name
             FROM community_service_attendance csa
             JOIN community_service_assignments a ON a.id = csa.assignment_id
             JOIN students s ON s.id = csa.student_id
             JOIN departments d ON d.id = csa.department_id WHERE csa.assignment_id = $1
             ${departmentScoped ? 'AND csa.department_id = $2 AND a.department_id = $2' : ''}
             ORDER BY csa.scanned_at DESC, csa.id DESC`, departmentScoped ? [req.params.assignmentId, req.user.department_id] : [req.params.assignmentId]);
        return res.json({ success: true, assignment_id: Number(req.params.assignmentId), total_records: result.rows.length, attendance: result.rows });
    } catch (error) { return sendError(res, error, "get community service attendance"); }
};

module.exports = { communityServiceTimeIn, communityServiceTimeOut, getCommunityServiceAttendance, getCommunityServiceSessions, reviewCommunityServiceResult, getPendingServiceResults, getActiveDepartmentSessions, parseDateFilters };
