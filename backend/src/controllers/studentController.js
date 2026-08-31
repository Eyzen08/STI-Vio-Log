const pool = require("../config/database");
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { isValidEmail, isValidPhone, sanitizeString, isPositiveId, isValidStudentNumber, assertAllowedFields, parsePagination } = require("../utils/validators");

const getStudents = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["page", "limit"]);
        const { page, limit, offset } = parsePagination(req.query);
        const result = await pool.query(`
            SELECT
                id, student_number, first_name, middle_name, last_name,
                suffix, email, phone_number, program, section, year_level,
                qr_code, profile_image, created_at, updated_at
            FROM students
            ORDER BY last_name ASC, first_name ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({
            success: true,
            students: result.rows,
            pagination: { page, limit, returned: result.rows.length }
        });
    } catch (error) {
        console.error("Get students error:", error);

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to get students"
        });
    }
};

const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT
                id, student_number, first_name, middle_name, last_name,
                suffix, email, phone_number, program, section, year_level,
                qr_code, profile_image, created_at, updated_at
             FROM students WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.json({
            success: true,
            student: result.rows[0]
        });
    } catch (error) {
        console.error("Get student by id error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get student"
        });
    }
};

const createStudent = async (req, res) => {
    let client;
    try {
        assertAllowedFields(req.body, ["student_number", "first_name", "middle_name", "last_name", "suffix", "email", "phone_number", "program", "section", "year_level", "qr_code", "profile_image"]);
        const { student_number, first_name, middle_name, last_name, suffix, email, phone_number, program, section, year_level, qr_code, profile_image } = req.body;
        if (!student_number || !first_name || !last_name || !qr_code) return res.status(400).json({ success: false, message: "student_number, first_name, last_name, and qr_code are required" });
        if (!isValidStudentNumber(student_number)) return res.status(400).json({ success: false, message: "student_number must be a valid school-issued identifier of at most 50 characters without spaces" });
        if (email && !isValidEmail(email)) return res.status(400).json({ success: false, message: "Invalid email format" });
        if (phone_number && !isValidPhone(phone_number)) return res.status(400).json({ success: false, message: "Invalid phone number format" });
        const payload = { student_number:sanitizeString(student_number), first_name:sanitizeString(first_name), middle_name:sanitizeString(middle_name), last_name:sanitizeString(last_name), suffix:sanitizeString(suffix), email:sanitizeString(email), phone_number:sanitizeString(phone_number), program:sanitizeString(program), section:sanitizeString(section), year_level:year_level !== undefined ? Number(year_level) : null, qr_code:sanitizeString(qr_code), profile_image:sanitizeString(profile_image) };
        client = await pool.connect();
        await client.query('BEGIN');
        const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
        const account = (await client.query("INSERT INTO users (username,password_hash,role,is_active) VALUES ($1,$2,'STUDENT',TRUE) RETURNING id", [payload.student_number,passwordHash])).rows[0];
        const result = await client.query(`INSERT INTO students (user_id,student_number,first_name,middle_name,last_name,suffix,email,phone_number,program,section,year_level,qr_code,profile_image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [account.id,payload.student_number,payload.first_name,payload.middle_name||null,payload.last_name,payload.suffix||null,payload.email||null,payload.phone_number||null,payload.program||null,payload.section||null,payload.year_level||null,payload.qr_code,payload.profile_image||null]);
        await client.query(`INSERT INTO audit_logs (user_id,action,table_name,record_id,description,ip_address) VALUES ($1,'STUDENT_CREATE','students',$2,'Created enrolled student record and linked local account',$3)`, [req.user.id,result.rows[0].id,req.ip||null]);
        await client.query('COMMIT');
        return res.status(201).json({ success:true, student:result.rows[0] });
    } catch (error) {
        if (client) try { await client.query('ROLLBACK'); } catch (_) {}
        console.error("Create student error:", error);
        return res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ success:false, message:error.statusCode ? error.message : error.code === '23505' ? "A student account with that student number already exists" : "Failed to create student" });
    } finally { if (client) client.release(); }
};

const updateStudent = async (req, res) => {
    let client;
    try {
        const { id } = req.params;
        const allowedFields = [
            "student_number", "first_name", "middle_name", "last_name",
            "suffix", "email", "phone_number", "program", "section",
            "year_level", "qr_code", "profile_image", "reason"
        ];
        assertAllowedFields(req.body, allowedFields);
        const reason = sanitizeString(req.body.reason);
        if (!reason || reason.length > 1000) return res.status(400).json({ success: false, message: "A reason of at most 1000 characters is required" });
        if (req.body.student_number !== undefined && !isValidStudentNumber(req.body.student_number)) {
            return res.status(400).json({ success: false, message: "student_number must be a valid school-issued identifier of at most 50 characters without spaces" });
        }
        if (req.body.first_name !== undefined && !sanitizeString(req.body.first_name)) return res.status(400).json({ success:false, message:'First name is required' });
        if (req.body.last_name !== undefined && !sanitizeString(req.body.last_name)) return res.status(400).json({ success:false, message:'Last name is required' });
        if (req.body.email && !isValidEmail(req.body.email)) return res.status(400).json({ success: false, message: "Invalid email format" });
        if (req.body.phone_number && !isValidPhone(req.body.phone_number)) return res.status(400).json({ success: false, message: "Invalid phone number format" });
        if (req.body.year_level !== undefined && req.body.year_level !== null && (!Number.isInteger(Number(req.body.year_level)) || Number(req.body.year_level) < 1 || Number(req.body.year_level) > 8)) return res.status(400).json({ success:false, message:'Year level must be between 1 and 8' });
        const fields = [];
        const values = [];

        for (const field of allowedFields.filter((field) => field !== "reason")) {
            if (req.body[field] !== undefined) {
                const value = field === "year_level" ? (req.body[field] === null || req.body[field] === '' ? null : Number(req.body[field])) : sanitizeString(req.body[field]);
                values.push(value === "" ? null : value);
                fields.push(`${field} = $${values.length}`);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No student fields provided for update"
            });
        }

        client = await pool.connect();
        await client.query('BEGIN');
        const current = (await client.query('SELECT id,user_id,student_number FROM students WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!current) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        values.push(id);
        const result = await client.query(
            `
                UPDATE students
                SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );
        if (req.body.student_number !== undefined && req.body.student_number.trim() !== current.student_number) {
            await client.query('UPDATE users SET username=$2,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [current.user_id, req.body.student_number.trim().toLowerCase()]);
        }
        await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,'STUDENT_UPDATE','students',$2,$3,$4)`, [req.user.id, current.id, `Updated student information: ${reason}`, req.ip || null]);
        await client.query('COMMIT');

        return res.json({
            success: true,
            student: result.rows[0]
        });
    } catch (error) {
        if (client) try { await client.query('ROLLBACK'); } catch (_) {}
        console.error("Update student error:", error);

        return res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({
            success: false,
            message: error.statusCode ? error.message : error.code === '23505' ? "That Student Number is already in use" : "Failed to update student"
        });
    } finally { if (client) client.release(); }
};

const resetStudentPassword = async (req, res) => {
    let client;
    try {
        assertAllowedFields(req.body, ['reason']);
        const reason = sanitizeString(req.body.reason);
        if (!isPositiveId(req.params.id) || !reason || reason.length > 1000) return res.status(400).json({ success:false, message:'A valid student and required reason are required' });
        client = await pool.connect();
        await client.query('BEGIN');
        const account = (await client.query(`SELECT u.id,u.username FROM students s JOIN users u ON u.id=s.user_id AND u.role='STUDENT' WHERE s.id=$1 FOR UPDATE OF u`, [Number(req.params.id)])).rows[0];
        if (!account) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success:false, message:'Student account not found' });
        }
        const temporaryPassword = crypto.randomBytes(18).toString('base64url') + '!Aa1';
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        await client.query(`UPDATE users SET password_hash=$2,is_active=TRUE,deactivated_at=NULL,deactivated_by=NULL,must_change_password=TRUE,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [account.id, passwordHash]);
        await client.query(`INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,'STUDENT_PASSWORD_RESET','users',$2,$3,$4)`, [req.user.id, account.id, `Issued student temporary password: ${reason}`, req.ip || null]);
        await client.query('COMMIT');
        return res.json({ success:true, message:'Temporary password generated', account:{ username:account.username }, temporary_password:temporaryPassword });
    } catch (error) {
        if (client) try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Reset student password error:', error);
        return res.status(error.statusCode || 500).json({ success:false, message:error.statusCode ? error.message : 'Failed to issue student password' });
    } finally { if (client) client.release(); }
};

const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM students WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.json({
            success: true,
            message: "Student deleted successfully"
        });
    } catch (error) {
        console.error("Delete student error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete student"
        });
    }
};
const getMyProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id, student_number, first_name, middle_name, last_name,
                suffix, email, phone_number, program, section, year_level,
                qr_code, profile_image,
                (SELECT phone_number FROM student_guardians
                 WHERE student_id = students.id ORDER BY is_primary DESC, id ASC LIMIT 1)
                    AS guardian_phone_number
             FROM students
             WHERE user_id = $1
             LIMIT 1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No student profile is linked to this account"
            });
        }

        return res.json({
            success: true,
            student: result.rows[0]
        });
    } catch (error) {
        console.error("Get my student profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get your student profile"
        });
    }
};

// =====================================================
// GET LOGGED-IN STUDENT'S VIOLATIONS
// =====================================================
// Uses req.user.id from the authenticated JWT.
//
// users.id
//     ↓
// students.user_id
//     ↓
// students.id
//     ↓
// violations.student_id
//
// This ensures students can only see their own violations.
// =====================================================

const getMyViolations = async (req, res) => {
    try {
        assertAllowedFields(req.query, []);
        const userId = req.user.id;

        // -------------------------------------------------
        // Find the student linked to the authenticated user
        // -------------------------------------------------

        const studentResult = await pool.query(
            `
            SELECT
                id,
                student_number,
                first_name,
                last_name
            FROM students
            WHERE user_id = $1
            `,
            [userId]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "No student profile is linked to this account"
            });
        }

        const student = studentResult.rows[0];

        // -------------------------------------------------
        // Get only this student's violations
        // -------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                v.id,
                v.student_id,
                v.violation_type_id,
                vt.violation_code,
                vt.violation_name,
                vt.severity,
                v.incident_date,
                v.description,
                v.status,
                COALESCE(cs.required_hours, v.required_service_hours) AS required_service_hours,
                COALESCE(cs.completed_hours, v.completed_service_hours) AS completed_service_hours,
                GREATEST(
                    COALESCE(cs.remaining_hours, v.required_service_hours - v.completed_service_hours),
                    0
                ) AS remaining_service_hours,
                v.cleared_at,
                v.created_at,
                v.updated_at,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', va.id,
                            'action', va.action,
                            'from_status', va.from_status,
                            'to_status', va.to_status,
                            'reason', va.reason,
                            'performed_by_role', va.performed_by_role,
                            'created_at', va.created_at
                        ) ORDER BY va.created_at, va.id
                    ) FILTER (WHERE va.id IS NOT NULL),
                    '[]'::json
                ) AS history
            FROM violations v
            JOIN violation_types vt ON vt.id = v.violation_type_id
            LEFT JOIN community_service_assignments cs ON cs.violation_id = v.id
            LEFT JOIN violation_actions va ON va.violation_id = v.id
            WHERE v.student_id = $1
            GROUP BY v.id, vt.id, cs.id
            ORDER BY
                v.incident_date DESC,
                v.id DESC
            `,
            [student.id]
        );

        return res.json({
            success: true,
            student_id: Number(student.id),
            student: {
                student_number: student.student_number,
                first_name: student.first_name,
                last_name: student.last_name
            },
            violations: result.rows
        });

    } catch (error) {
        console.error(
            "Get my violations error:",
            error
        );

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to get student violations"
        });
    }
};


module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    resetStudentPassword,
    deleteStudent,
    getMyProfile,
    getMyViolations
};
