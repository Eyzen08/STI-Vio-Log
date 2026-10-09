const pool = require('../config/database');
const { CommunityServiceSessionError, recordTimeIn, recordTimeOut, availableSupervisors, dailyCredit, hydrateSessions } = require('../services/communityServiceSessionService');
const { serviceDate, serviceAllowance } = require('../services/communityServiceTiming');
const { avatarSql } = require('../services/avatarService');
const { requireAuthorizedDepartment } = require('../middleware/authMiddleware');
const { sendError } = require('../utils/api');
const { assertAllowedFields, isPositiveId } = require('../utils/validators');
const { emitAttendanceChange, emitNotificationChange } = require('../services/realtimeEventService');
const { notifyAttendanceFailure } = require('../services/notificationService');

const validateQrBody = (req) => {
    assertAllowedFields(req.body, ['qr_code','assignment_id','session_id','notes','attendance_outcome','supervising_officer_id','session_type','selected_duration_minutes',...(req.user.role === 'DEPARTMENT_HEAD' ? [] : ['department_id'])]);
    const qrCode = typeof req.body.qr_code === 'string' ? req.body.qr_code.trim() : '';
    const notes = req.body.notes == null ? '' : typeof req.body.notes === 'string' ? req.body.notes.trim() : null;
    if (!qrCode || qrCode.length > 256 || notes === null || notes.length > 500) throw new CommunityServiceSessionError('A valid QR code and optional note are required',400);
    for (const field of ['assignment_id','session_id','supervising_officer_id','department_id']) {
        if (req.body[field] != null && !isPositiveId(req.body[field])) throw new CommunityServiceSessionError('A valid '+field+' is required',400);
    }
    req.body.qr_code = qrCode;
    req.body.notes = notes;
};

const resolveQr = async (req,res,recording=false) => {
    if (req.user.role==='DEPARTMENT_HEAD') {
        let enabled = false;
        await requireAuthorizedDepartment({...req,body:{}},res,()=>{enabled=true;});
        if (!enabled) return null;
    }
    const student = (await pool.query("SELECT s.id,s.student_number,s.first_name,s.middle_name,s.last_name,s.suffix,s.academic_level,s.strand,s.program,s.section,s.year_level,"+avatarSql('s.user_id')+" AS avatar FROM students s JOIN users u ON u.id=s.user_id WHERE s.qr_code=$1 AND u.is_active=TRUE",[req.body.qr_code])).rows[0];
    if (!student) throw new CommunityServiceSessionError('Student not found or inactive',404);
    const scope = req.user.role==='DEPARTMENT_HEAD' ? req.user.department_id : null;
    // A session in another department also prevents a duplicate Time In.
    const active = (await pool.query(
        "SELECT css.*,css.id AS session_id,a.required_hours,a.completed_hours,a.remaining_hours,d.department_name FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id JOIN departments d ON d.id=css.department_id WHERE css.student_id=$1 AND css.time_out IS NULL",[student.id])).rows[0];
    const assignments = (await pool.query(
        "SELECT a.*,d.department_name,d.department_code FROM community_service_assignments a JOIN violations v ON v.id=a.violation_id JOIN departments d ON d.id=a.department_id WHERE a.student_id=$1 AND a.status IN ('OPEN','IN_PROGRESS') AND v.status='OPEN' AND d.is_active=TRUE AND ($2::bigint IS NULL OR a.department_id=$2) ORDER BY a.id DESC",[student.id,scope || null])).rows;
    let assignment = active && (!scope || Number(active.department_id)===Number(scope)) ? assignments.find(a => Number(a.id)===Number(active.assignment_id)) : null;
    if (req.body.session_id) {
        assignment = (await pool.query(
            "SELECT a.*,d.department_name,d.department_code FROM community_service_assignments a JOIN community_service_sessions css ON css.assignment_id=a.id JOIN departments d ON d.id=a.department_id WHERE css.id=$1 AND a.student_id=$2",[req.body.session_id,student.id])).rows[0];
        if (!assignment) throw new CommunityServiceSessionError('Service session not found',404);
    } else if (req.body.assignment_id && !assignment) {
        assignment = assignments.find(a => Number(a.id)===Number(req.body.assignment_id));
        if (!assignment && recording) throw new CommunityServiceSessionError('Eligible service assignment not found',404);
    }
    if (!assignment && assignments.length===1) assignment = assignments[0];
    if (scope || assignment) {
        const authorizationReq = {...req,body:{...req.body,...(assignment ? {assignment_id:assignment.id} : {})}};
        let authorized = false;
        await requireAuthorizedDepartment(authorizationReq,res,() => { authorized=true; });
        if (!authorized) return null;
        req.staffDepartmentId = authorizationReq.staffDepartmentId;
    }
    const now = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
    const completedToday = await dailyCredit(pool,student.id,serviceDate(now));
    const activeVisible = active && (!scope || Number(active.department_id)===Number(scope));
    const activeSession = activeVisible ? (await hydrateSessions(pool,[active]))[0] : null;
    return { student,assignments,assignment:assignment || null,active_session:activeSession,
        active_session_elsewhere:Boolean(active && !activeVisible),server_time:now,
        allowance:serviceAllowance(assignment || {remaining_hours:0},completedToday,now),
        available_officers:assignment ? await availableSupervisors(pool,assignment.department_id) : [],
        student_status:active ? 'Currently timed in' : assignments.length ? 'Eligible for community service' : 'No active service requirement' };
};
const respondError = (res,error) => {
    const status = error.statusCode || 500;
    if (status===500) console.error('QR attendance error:',error);
    return sendError(res,status,error.code || (status===500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR'),status===500 ? 'Unable to process QR attendance' : error.message);
};
const scanQrCode = async (req,res) => {
    try {
        validateQrBody(req);
        const verified = await resolveQr(req,res);
        if (!verified) return;
        return res.json({success:true,message:'Student verified',...verified});
    } catch(error) { return respondError(res,error); }
};
const handle = (operation) => async (req,res) => {
    let verified;
    try {
        validateQrBody(req);
        verified = await resolveQr(req,res,true);
        if (!verified) return;
        if (operation==='time-in' && (verified.active_session || verified.active_session_elsewhere)) throw new CommunityServiceSessionError('Student already has an active service session',409,'ACTIVE_SESSION_EXISTS');
        if (!verified.assignment) throw new CommunityServiceSessionError('Select an eligible service assignment',400,'ASSIGNMENT_SELECTION_REQUIRED');
        const result = await (operation==='time-in' ? recordTimeIn : recordTimeOut)({ assignmentId:verified.assignment.id,
            sessionId:req.body.session_id,expectedStudentId:verified.student.id,departmentId:req.staffDepartmentId,
            supervisingOfficerId:req.body.supervising_officer_id,sessionType:req.body.session_type,
            selectedDurationMinutes:req.body.selected_duration_minutes,actor:req.user,notes:req.body.notes,ipAddress:req.ip,writeQrLog:true });
        if (!result.already_completed) await emitAttendanceChange(result, req.staffDepartmentId);
        return res.status(result.already_completed ? 200 : 201).json({success:true,message:'Community service '+operation+' saved',...verified,...result,studentId:verified.student.id});
    } catch(error) {
        if (verified?.student && req.staffDepartmentId && error.statusCode && !verified.active_session_elsewhere) {
            try {
                await notifyAttendanceFailure(pool,{studentId:verified.student.id,departmentId:req.staffDepartmentId,supervisorId:req.body.supervising_officer_id,action:operation==='time-in'?'TIME_IN':'TIME_OUT',status:error.code});
                emitNotificationChange(req.staffDepartmentId,{student_id:verified.student.id,action:'ATTENDANCE_FAILED'});
            } catch(notificationError) { console.error('Attendance failure notification error:',notificationError.message); }
        }
        return respondError(res,error);
    }
};
module.exports = {scanQrCode,timeIn:handle('time-in'),timeOut:handle('time-out')};
