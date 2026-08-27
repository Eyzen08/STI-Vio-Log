const pool = require("../config/database");
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
    try {
        assertAllowedFields(req.body, ["user_id", "student_number", "first_name", "middle_name", "last_name", "suffix", "email", "phone_number", "program", "section", "year_level", "qr_code", "profile_image"]);
        const {
            user_id,
            student_number,
            first_name,
            middle_name,
            last_name,
            suffix,
            email,
            phone_number,
            program,
            section,
            year_level,
            qr_code,
            profile_image
        } = req.body;

        if (!user_id || !student_number || !first_name || !last_name || !qr_code) {
            return res.status(400).json({
                success: false,
                message: "user_id, student_number, first_name, last_name, and qr_code are required"
            });
        }

        if (!isPositiveId(user_id) || !isValidStudentNumber(student_number)) {
            return res.status(400).json({ success: false, message: "user_id must be a positive ID and student_number must match 02000 followed by exactly 6 digits" });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        if (phone_number && !isValidPhone(phone_number)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

        const payload = {
            user_id: Number(user_id),
            student_number: sanitizeString(student_number),
            first_name: sanitizeString(first_name),
            middle_name: sanitizeString(middle_name),
            last_name: sanitizeString(last_name),
            suffix: sanitizeString(suffix),
            email: sanitizeString(email),
            phone_number: sanitizeString(phone_number),
            program: sanitizeString(program),
            section: sanitizeString(section),
            year_level: year_level !== undefined ? Number(year_level) : null,
            qr_code: sanitizeString(qr_code),
            profile_image: sanitizeString(profile_image)
        };

        const result = await pool.query(
            `
                INSERT INTO students (
                    user_id,
                    student_number,
                    first_name,
                    middle_name,
                    last_name,
                    suffix,
                    email,
                    phone_number,
                    program,
                    section,
                    year_level,
                    qr_code,
                    profile_image
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `,
            [
                user_id,
                student_number,
                first_name,
                middle_name || null,
                last_name,
                suffix || null,
                email || null,
                phone_number || null,
                program || null,
                section || null,
                year_level || null,
                qr_code,
                profile_image || null
            ]
        );

        return res.status(201).json({
            success: true,
            student: result.rows[0]
        });
    } catch (error) {
        console.error("Create student error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to create student"
        });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const allowedFields = [
            "student_number", "first_name", "middle_name", "last_name",
            "suffix", "email", "phone_number", "program", "section",
            "year_level", "qr_code", "profile_image"
        ];
        assertAllowedFields(req.body, allowedFields);
        if (req.body.student_number !== undefined && !isValidStudentNumber(req.body.student_number)) {
            return res.status(400).json({ success: false, message: "student_number must match 02000 followed by exactly 6 digits" });
        }
        const fields = [];
        const values = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                values.push(req.body[field]);
                fields.push(`${field} = $${values.length}`);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No student fields provided for update"
            });
        }

        values.push(id);

        const result = await pool.query(
            `
                UPDATE students
                SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
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
        console.error("Update student error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to update student"
        });
    }
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
                suffix, email, program, section, year_level,
                qr_code, profile_image
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
                v.reported_by,
                v.incident_date,
                v.description,
                v.status,
                v.required_service_hours,
                v.completed_service_hours,
                GREATEST(
                    v.required_service_hours -
                    v.completed_service_hours,
                    0
                ) AS remaining_service_hours,
                v.cleared_at,
                v.created_at,
                v.updated_at
            FROM violations v
            WHERE v.student_id = $1
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

        return res.status(500).json({
            success: false,
            message:
                "Failed to get student violations"
        });
    }
};


module.exports = {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getMyProfile,
    getMyViolations
};
