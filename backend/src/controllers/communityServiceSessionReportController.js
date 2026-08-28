const pool = require("../config/database");
const { CommunityServiceSessionError } = require("../services/communityServiceSessionService");
const { parseDateFilters } = require("./communityServiceAttendanceController");
const { sendError } = require("../utils/api");
const { assertAllowedFields } = require("../utils/validators");

const fail = (res, error) => {
    console.error("Community service DTR report error:", error);
    const status = error.statusCode || 500;
    return sendError(res, status, error.code || (status === 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR"), status === 500 ? "Failed to generate DTR report" : error.message);
};

const validatePositiveId = (name, value) => {
    if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1)) throw new CommunityServiceSessionError(`${name} must be a positive integer`, 400);
};

const getDTRReport = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["from", "to", "department_id", "student_id", "assignment_id"]);
        const { from, to } = parseDateFilters(req.query);
        const { department_id, student_id, assignment_id } = req.query;
        validatePositiveId("department_id", department_id); validatePositiveId("student_id", student_id); validatePositiveId("assignment_id", assignment_id);
        if (req.user.role === "DEPARTMENT_HEAD" && department_id && Number(department_id) !== Number(req.user.department_id)) return res.status(403).json({ success: false, message: "Department Heads can only access their own department" });
        const effectiveDepartment = req.user.role === "DEPARTMENT_HEAD" ? req.user.department_id : department_id;
        if (effectiveDepartment) {
            const department = await pool.query("SELECT id FROM departments WHERE id = $1 AND is_active = TRUE", [effectiveDepartment]);
            if (!department.rows.length) throw new CommunityServiceSessionError("Department not found or inactive", 400);
        }
        const params = [];
        let filters = "";
        const add = (value, sql) => { params.push(value); filters += sql.replace("?", `$${params.length}`); };
        if (effectiveDepartment) add(effectiveDepartment, " AND css.department_id = ?");
        if (student_id) add(student_id, " AND a.student_id = ?");
        if (assignment_id) add(assignment_id, " AND a.id = ?");
        if (from) add(from, " AND css.time_in >= (?::date::timestamp AT TIME ZONE 'UTC')");
        if (to) add(to, " AND css.time_in < ((?::date + 1)::timestamp AT TIME ZONE 'UTC')");
        const result = await pool.query(
            `SELECT a.id AS assignment_id, a.student_id, s.student_number, s.first_name, s.last_name,
                    a.violation_id, css.department_id, d.department_name, a.required_hours,
                    a.completed_hours AS credited_hours, a.remaining_hours, a.status AS assignment_status,
                    COUNT(*) FILTER (WHERE css.status = 'COMPLETED')::int AS total_completed_sessions,
                    COALESCE(SUM(css.worked_minutes) FILTER (WHERE css.status = 'COMPLETED'), 0)::int AS total_worked_minutes,
                    COALESCE(SUM(css.credited_minutes) FILTER (WHERE css.status = 'COMPLETED'), 0)::int AS total_credited_minutes,
                    MIN(css.time_in) AS first_attendance_at, MAX(COALESCE(css.time_out, css.time_in)) AS latest_attendance_at
             FROM community_service_sessions css JOIN community_service_assignments a ON a.id = css.assignment_id
             JOIN students s ON s.id = a.student_id JOIN departments d ON d.id = css.department_id
             WHERE 1=1${filters}
             GROUP BY a.id, a.student_id, s.student_number, s.first_name, s.last_name,
                      a.violation_id, css.department_id, d.department_name
             ORDER BY latest_attendance_at DESC, a.id DESC`, params);
        const totals = result.rows.reduce((sum, row) => ({ completed_sessions: sum.completed_sessions + row.total_completed_sessions, worked_minutes: sum.worked_minutes + row.total_worked_minutes, credited_minutes: sum.credited_minutes + row.total_credited_minutes }), { completed_sessions: 0, worked_minutes: 0, credited_minutes: 0 });
        return res.json({ success: true, report_type: "community_service_dtr", timezone: "UTC", filters: { from: from || null, to: to || null, department_id: effectiveDepartment ? Number(effectiveDepartment) : null, student_id: student_id ? Number(student_id) : null, assignment_id: assignment_id ? Number(assignment_id) : null }, totals, total_records: result.rows.length, data: result.rows, generated_at: new Date().toISOString() });
    } catch (error) { return fail(res, error); }
};

const getMyDTR = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["from", "to"]);
        const { from, to } = parseDateFilters(req.query);
        if (req.query.student_id || req.query.department_id || req.query.assignment_id) throw new CommunityServiceSessionError("Student DTR only supports from and to filters", 400);
        const params = [req.user.id]; let filters = "";
        if (from) { params.push(from); filters += ` AND css.time_in >= ($${params.length}::date::timestamp AT TIME ZONE 'UTC')`; }
        if (to) { params.push(to); filters += ` AND css.time_in < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'UTC')`; }
        const assignments = await pool.query(
            `SELECT a.id AS assignment_id, a.violation_id, a.department_id, d.department_name,
                    a.department_head_id, dh.first_name AS department_head_first_name,
                    dh.last_name AS department_head_last_name,
                    ROUND(a.required_hours * 60)::int AS required_minutes,
                    ROUND(a.completed_hours * 60)::int AS credited_minutes,
                    ROUND(a.remaining_hours * 60)::int AS remaining_minutes, a.status
             FROM community_service_assignments a JOIN students s ON s.id = a.student_id
             LEFT JOIN departments d ON d.id = a.department_id
             LEFT JOIN department_heads dh ON dh.id = a.department_head_id
             WHERE s.user_id = $1 ORDER BY a.assigned_at DESC`, [req.user.id]);
        const sessions = await pool.query(
            `SELECT css.id, css.assignment_id, css.department_id, d.department_name,
                    css.time_in, css.time_out, css.worked_minutes, css.credited_minutes, css.status
             FROM community_service_sessions css JOIN community_service_assignments a ON a.id = css.assignment_id
             JOIN students s ON s.id = a.student_id JOIN departments d ON d.id = css.department_id
             WHERE s.user_id = $1${filters} ORDER BY css.time_in DESC, css.id DESC`, params);
        return res.json({ success: true, timezone: "UTC", assignments: assignments.rows, total_sessions: sessions.rows.length, sessions: sessions.rows });
    } catch (error) { return fail(res, error); }
};

module.exports = { getDTRReport, getMyDTR };
