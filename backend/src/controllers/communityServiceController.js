const pool = require("../config/database");
const { assertAllowedFields, isPositiveId, parsePagination } = require("../utils/validators");

// =====================================================
// GET ALL COMMUNITY SERVICE ASSIGNMENTS
// =====================================================
const getCommunityServiceAssignments = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["page", "limit"]);
        const { page, limit, offset } = parsePagination(req.query);
        const departmentScoped = req.user.role === "DEPARTMENT_HEAD";
        const params = departmentScoped ? [req.user.department_id, limit, offset] : [limit, offset];
        const result = await pool.query(`
            SELECT
                cs.id,
                cs.violation_id,
                cs.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                cs.required_hours,
                cs.completed_hours,
                cs.remaining_hours,
                cs.status,
                cs.assigned_at,
                cs.completed_at
            FROM community_service_assignments cs
            JOIN students s
                ON cs.student_id = s.id
            ${departmentScoped ? `WHERE EXISTS (
                SELECT 1 FROM community_service_sessions scoped_session
                WHERE scoped_session.assignment_id = cs.id
                  AND scoped_session.department_id = $1
            )` : ""}
            ORDER BY cs.assigned_at DESC, cs.id DESC
            LIMIT $${departmentScoped ? 2 : 1} OFFSET $${departmentScoped ? 3 : 2}
        `, params);

        return res.json({
            success: true,
            assignments: result.rows,
            pagination: { page, limit, returned: result.rows.length }
        });

    } catch (error) {
        console.error(
            "Get community service assignments error:",
            error
        );

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to get community service assignments"
        });
    }
};


// =====================================================
// GET COMMUNITY SERVICE ASSIGNMENT BY ID
// =====================================================
const getCommunityServiceAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const departmentScoped = req.user.role === "DEPARTMENT_HEAD";
        const result = await pool.query(
            `
            SELECT
                cs.id,
                cs.violation_id,
                cs.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                cs.required_hours,
                cs.completed_hours,
                cs.remaining_hours,
                cs.status,
                cs.assigned_at,
                cs.completed_at
            FROM community_service_assignments cs
            JOIN students s
                ON cs.student_id = s.id
            WHERE cs.id = $1
              ${departmentScoped ? `AND EXISTS (
                SELECT 1 FROM community_service_sessions scoped_session
                WHERE scoped_session.assignment_id = cs.id
                  AND scoped_session.department_id = $2
              )` : ""}
            `,
            departmentScoped ? [id, req.user.department_id] : [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community service assignment not found"
            });
        }

        return res.json({
            success: true,
            assignment: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Get community service assignment by id error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get assignment",
            error: error.message
        });
    }
};


// =====================================================
// CREATE COMMUNITY SERVICE ASSIGNMENT
// =====================================================
const createCommunityServiceAssignment = async (req, res) => {
    const client = await pool.connect();
    try {
        assertAllowedFields(req.body, ["violation_id", "student_id", "required_hours"]);
        const {
            violation_id,
            student_id,
            required_hours
        } = req.body;

        if (!violation_id || !student_id || required_hours === undefined) {
            return res.status(400).json({
                success: false,
                message:
                    "violation_id, student_id, and required_hours are required"
            });
        }

        if (!isPositiveId(violation_id) || !isPositiveId(student_id)) return res.status(400).json({ success: false, message: "violation_id and student_id must be positive IDs" });
        const required = Number(required_hours);

        if (Number.isNaN(required) || required < 0) {
            return res.status(400).json({
                success: false,
                message: "required_hours must be a valid non-negative number"
            });
        }

        await client.query("BEGIN");

        const violationResult = await client.query(
            `SELECT id, student_id, status
             FROM violations
             WHERE id = $1
             FOR UPDATE`,
            [violation_id]
        );

        if (violationResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Violation not found" });
        }

        const violation = violationResult.rows[0];
        if (Number(violation.student_id) !== Number(student_id)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "The violation does not belong to the specified student" });
        }
        if (violation.status !== "OPEN") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Community service can only be assigned to an open violation" });
        }

        const result = await client.query(
            `
            INSERT INTO community_service_assignments (
                violation_id,
                student_id,
                required_hours,
                completed_hours,
                remaining_hours,
                status,
                completed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                violation_id,
                student_id,
                required,
                0,
                required,
                required <= 0 ? "COMPLETED" : "OPEN",
                required <= 0 ? new Date() : null
            ]
        );

        await client.query(
            `UPDATE violations
             SET required_service_hours = $1,
                 completed_service_hours = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [required, violation_id]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            assignment: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Create community service assignment error:",
            error
        );

        try { await client.query("ROLLBACK"); } catch (_) {}
        return res.status(error.statusCode || (error.code === "23505" ? 409 : 500)).json({
            success: false,
            message: error.statusCode ? error.message : error.code === "23505"
                ? "A community service assignment already exists for this violation"
                : "Failed to create assignment"
        });
    } finally {
        client.release();
    }
};


// =====================================================
// UPDATE COMMUNITY SERVICE ASSIGNMENT
// =====================================================
const updateCommunityServiceAssignment = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const required = Number(req.body.required_hours);

        const unsupportedFields = Object.keys(req.body).filter(
            (field) => field !== "required_hours"
        );

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Service progress, ownership, and status cannot be changed through this endpoint"
            });
        }

        if (req.body.required_hours === undefined || !Number.isFinite(required) || required < 0) {
            return res.status(400).json({
                success: false,
                message: "Only a valid non-negative required_hours value may be updated directly"
            });
        }

        await client.query("BEGIN");
        const currentResult = await client.query(
            `SELECT * FROM community_service_assignments WHERE id = $1 FOR UPDATE`,
            [id]
        );

        if (currentResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Community service assignment not found" });
        }

        const current = currentResult.rows[0];
        const completed = Number(current.completed_hours || 0);
        if (required < completed) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "required_hours cannot be less than completed_hours" });
        }

        const remaining = Math.max(required - completed, 0);
        const status = remaining <= 0
            ? "COMPLETED"
            : completed > 0 ? "IN_PROGRESS" : "OPEN";

        const result = await client.query(
            `
            UPDATE community_service_assignments
            SET required_hours = $1,
                remaining_hours = $2,
                status = $3,
                completed_at = $4
            WHERE id = $5
            RETURNING *
            `,
            [required, remaining, status, remaining <= 0 ? current.completed_at || new Date() : null, id]
        );

        await client.query(
            `UPDATE violations
             SET required_service_hours = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [required, current.violation_id]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            assignment: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Update community service assignment error:",
            error
        );

        try { await client.query("ROLLBACK"); } catch (_) {}
        return res.status(500).json({
            success: false,
            message: "Failed to update community service assignment"
        });
    } finally {
        client.release();
    }
};


// =====================================================
// DELETE COMMUNITY SERVICE ASSIGNMENT
// =====================================================
const deleteCommunityServiceAssignment = async (req, res) => {
    return res.status(400).json({
        success: false,
        message: "Community service assignments are retained as disciplinary history and cannot be permanently deleted"
    });
};

// =====================================================
// GET MY COMMUNITY SERVICE ASSIGNMENT - STUDENT
// =====================================================
const getMyCommunityServiceAssignment = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                cs.id,
                cs.violation_id,
                cs.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                cs.required_hours,
                cs.completed_hours,
                cs.remaining_hours,
                cs.status,
                cs.assigned_at,
                cs.completed_at
            FROM community_service_assignments cs
            JOIN students s
                ON cs.student_id = s.id
            WHERE s.user_id = $1
            ORDER BY cs.assigned_at DESC, cs.id DESC
            `,
            [req.user.id]
        );

        return res.json({
            success: true,
            assignments: result.rows
        });

    } catch (error) {
        console.error(
            "Get my community service assignment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get your community service assignments",
            error: error.message
        });
    }
};

module.exports = {
    getCommunityServiceAssignments,
    getCommunityServiceAssignmentById,
    createCommunityServiceAssignment,
    getMyCommunityServiceAssignment,
    updateCommunityServiceAssignment,
    deleteCommunityServiceAssignment
};
