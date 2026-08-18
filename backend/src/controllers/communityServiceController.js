const pool = require("../config/database");

// =====================================================
// GET ALL COMMUNITY SERVICE ASSIGNMENTS
// =====================================================
const getCommunityServiceAssignments = async (req, res) => {
    try {
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
            ORDER BY cs.assigned_at DESC, cs.id DESC
        `);

        return res.json({
            success: true,
            assignments: result.rows
        });

    } catch (error) {
        console.error(
            "Get community service assignments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get community service assignments",
            error: error.message
        });
    }
};


// =====================================================
// GET COMMUNITY SERVICE ASSIGNMENT BY ID
// =====================================================
const getCommunityServiceAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;

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
            `,
            [id]
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
    try {
        const {
            violation_id,
            student_id,
            required_hours,
            completed_hours,
            remaining_hours,
            status,
            completed_at
        } = req.body;

        if (!violation_id || !student_id || required_hours === undefined) {
            return res.status(400).json({
                success: false,
                message:
                    "violation_id, student_id, and required_hours are required"
            });
        }

        const completed = Number(completed_hours || 0);
        const required = Number(required_hours);

        if (Number.isNaN(required) || required < 0) {
            return res.status(400).json({
                success: false,
                message: "required_hours must be a valid non-negative number"
            });
        }

        const remaining =
            remaining_hours !== undefined
                ? Number(remaining_hours)
                : Math.max(required - completed, 0);

        const assignmentStatus =
            status ||
            (remaining <= 0 ? "COMPLETED" : "OPEN");

        const completedAt =
            completed_at ||
            (remaining <= 0 ? new Date() : null);

        const result = await pool.query(
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
                completed,
                remaining,
                assignmentStatus,
                completedAt
            ]
        );

        return res.status(201).json({
            success: true,
            assignment: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Create community service assignment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to create assignment",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE COMMUNITY SERVICE ASSIGNMENT
// =====================================================
const updateCommunityServiceAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        const allowedFields = [
            "violation_id",
            "student_id",
            "required_hours",
            "completed_hours",
            "remaining_hours",
            "status",
            "completed_at"
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                values.push(req.body[field]);
                updates.push(
                    `${field} = $${values.length}`
                );
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "No community service assignment fields provided for update"
            });
        }

        values.push(id);

        const result = await pool.query(
            `
            UPDATE community_service_assignments
            SET ${updates.join(", ")}
            WHERE id = $${values.length}
            RETURNING *
            `,
            values
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
            "Update community service assignment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to update community service assignment",
            error: error.message
        });
    }
};


// =====================================================
// DELETE COMMUNITY SERVICE ASSIGNMENT
// =====================================================
const deleteCommunityServiceAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM community_service_assignments
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community service assignment not found"
            });
        }

        return res.json({
            success: true,
            message:
                "Community service assignment deleted successfully"
        });

    } catch (error) {
        console.error(
            "Delete community service assignment error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to delete assignment",
            error: error.message
        });
    }
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