const pool = require("../config/database");
const { CommunityServiceSessionError, recordTimeIn, recordTimeOut } = require("../services/communityServiceSessionService");
const { sendError: sendApiError } = require("../utils/api");
const { assertAllowedFields } = require("../utils/validators");
const { emitAttendanceChange } = require('../services/realtimeEventService');

const validateQrBody = (req) => {
    const allowed = req.user.role === "DEPARTMENT_HEAD"
        ? ["qr_code", "notes", "condition"]
        : ["qr_code", "notes", "condition", "department_id"];
    assertAllowedFields(req.body, allowed);
    const qrCode = typeof req.body.qr_code === "string" ? req.body.qr_code.trim() : "";
    const notes = req.body.notes == null ? "" : (typeof req.body.notes === "string" ? req.body.notes.trim() : null);
    if (!qrCode || qrCode.length > 256 || notes === null || notes.length > 500) {
        throw new CommunityServiceSessionError("A valid QR code and optional note are required", 400, "VALIDATION_ERROR");
    }
    req.body.qr_code = qrCode;
    req.body.notes = notes;
};

const findStudentAndAssignment = async (qrCode, departmentId) => {
    const studentResult = await pool.query(`SELECT id, student_number, first_name, last_name, qr_code FROM students WHERE qr_code = $1`, [qrCode]);
    if (!studentResult.rows.length) throw new CommunityServiceSessionError("Student not found", 404);
    const student = studentResult.rows[0];
    const assignmentResult = await pool.query(
        `SELECT a.* FROM community_service_assignments a JOIN violations v ON v.id = a.violation_id
         WHERE a.student_id = $1 AND a.status IN ('OPEN', 'IN_PROGRESS') AND v.status = 'OPEN'
           AND a.department_id = $2
         ORDER BY a.id DESC LIMIT 1`, [student.id, departmentId]);
    if (!assignmentResult.rows.length) throw new CommunityServiceSessionError("Student has no active community service assignment", 400);
    return { student, assignment: assignmentResult.rows[0] };
};

const respondError = (res, error, operation) => {
    console.error(`QR ${operation} error:`, error);
    const status = error.statusCode || (error instanceof CommunityServiceSessionError ? error.statusCode : 500);
    return sendApiError(res, status, error.code || (status === 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR"), status === 500 ? `Failed to ${operation}` : error.message);
};

const scanQrCode = async (req, res) => {
    try {
        validateQrBody(req);
        if (!req.body.qr_code || !req.staffDepartmentId) return res.status(400).json({ success: false, message: "qr_code and a valid staff department are required" });
        return res.json({ success: true, message: "QR code scanned successfully", ...(await findStudentAndAssignment(req.body.qr_code, req.staffDepartmentId)) });
    }
    catch (error) { return respondError(res, error, "scan QR code"); }
};

const handle = (operation) => async (req, res) => {
    try {
        validateQrBody(req);
        if (!req.body.qr_code || !req.staffDepartmentId) return res.status(400).json({ success: false, message: "qr_code and a valid staff department are required" });
        const { student, assignment } = await findStudentAndAssignment(req.body.qr_code, req.staffDepartmentId);
        const result = await (operation === "time-in" ? recordTimeIn : recordTimeOut)({ assignmentId: assignment.id, expectedStudentId: student.id, departmentId: req.staffDepartmentId, actor: req.user, notes: req.body.notes, condition: req.body.condition, ipAddress: req.ip, writeQrLog: true });
        await emitAttendanceChange(result, req.staffDepartmentId);
        return res.status(201).json({ success: true, message: `Community service QR ${operation} recorded successfully`, student, studentId: student.id, hours_worked: result.session.worked_minutes == null ? undefined : result.session.worked_minutes / 60, ...result });
    } catch (error) { return respondError(res, error, `record QR community service ${operation}`); }
};

module.exports = { scanQrCode, timeIn: handle("time-in"), timeOut: handle("time-out") };
