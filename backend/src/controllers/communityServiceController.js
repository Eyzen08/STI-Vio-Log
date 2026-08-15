const pool = require("../config/database");

const getCommunityServiceAssignments = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM community_service_assignments
            ORDER BY assigned_at DESC, id DESC
        `);

        res.json({
            success: true,
            assignments: result.rows
        });
    } catch (error) {
        console.error("Get community service assignments error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get community service assignments"
        });
    }
};

const getCommunityServiceAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM community_service_assignments WHERE id = $1`,
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
        console.error("Get community service assignment by id error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get assignment"
        });
    }
};

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

        if (!violation_id || !student_id || !required_hours) {
            return res.status(400).json({
                success: false,
                message: "violation_id, student_id, and required_hours are required"
            });
        }

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
                required_hours,
                completed_hours || 0,
                remaining_hours !== undefined ? remaining_hours : required_hours,
                status || "OPEN",
                completed_at || null
            ]
        );

        return res.status(201).json({
            success: true,
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error("Create community service assignment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create assignment"
        });
    }
};

const updateCommunityServiceAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            violation_id,
            student_id,
            required_hours,
            completed_hours,
            remaining_hours,
            status,
            completed_at
        } = req.body;

        const fields = [
            violation_id !== undefined ? "violation_id = $1" : null,
            student_id !== undefined ? "student_id = $2" : null,
            required_hours !== undefined ? "required_hours = $3" : null,
            completed_hours !== undefined ? "completed_hours = $4" : null,
            remaining_hours !== undefined ? "remaining_hours = $5" : null,
            status !== undefined ? "status = $6" : null,
            completed_at !== undefined ? "completed_at = $7" : null
        ].filter(Boolean);

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No community service assignment fields provided for update"
            });
        }

        const values = [
            violation_id,
            student_id,
            required_hours,
            completed_hours,
            remaining_hours,
            status,
            completed_at,
            id
        ].filter((value, index) => {
            const provided = [
                violation_id !== undefined,
                student_id !== undefined,
                required_hours !== undefined,
                completed_hours !== undefined,
                remaining_hours !== undefined,
                status !== undefined,
                completed_at !== undefined
            ];
            return provided[index];
        }).concat(id);

        const result = await pool.query(
            `UPDATE community_service_assignments SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
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
        console.error("Update assignment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update community service assignment"
        });
    }
};

const deleteCommunityServiceAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM community_service_assignments WHERE id = $1 RETURNING *`,
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
            message: "Community service assignment deleted successfully"
        });
    } catch (error) {
        console.error("Delete assignment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete assignment"
        });
    }
};

module.exports = {
    getCommunityServiceAssignments,
    getCommunityServiceAssignmentById,
    createCommunityServiceAssignment,
    updateCommunityServiceAssignment,
    deleteCommunityServiceAssignment
};
