const pool = require("../config/database");

const getViolations = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM violations
            ORDER BY incident_date DESC, id DESC
        `);

        res.json({
            success: true,
            violations: result.rows
        });
    } catch (error) {
        console.error("Get violations error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get violations"
        });
    }
};

const getViolationById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM violations WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        return res.json({
            success: true,
            violation: result.rows[0]
        });
    } catch (error) {
        console.error("Get violation by id error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get violation"
        });
    }
};

const createViolation = async (req, res) => {
    try {
        const {
            student_id,
            violation_type_id,
            reported_by,
            incident_date,
            description,
            status,
            required_service_hours,
            completed_service_hours,
            cleared_at
        } = req.body;

        if (!student_id || !violation_type_id || !incident_date) {
            return res.status(400).json({
                success: false,
                message: "student_id, violation_type_id, and incident_date are required"
            });
        }

        const result = await pool.query(
            `
                INSERT INTO violations (
                    student_id,
                    violation_type_id,
                    reported_by,
                    incident_date,
                    description,
                    status,
                    required_service_hours,
                    completed_service_hours,
                    cleared_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
            [
                student_id,
                violation_type_id,
                reported_by || null,
                incident_date,
                description || null,
                status || "OPEN",
                required_service_hours || 0,
                completed_service_hours || 0,
                cleared_at || null
            ]
        );

        return res.status(201).json({
            success: true,
            violation: result.rows[0]
        });
    } catch (error) {
        console.error("Create violation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create violation"
        });
    }
};

const updateViolation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            student_id,
            violation_type_id,
            reported_by,
            incident_date,
            description,
            status,
            required_service_hours,
            completed_service_hours,
            cleared_at
        } = req.body;

        const fields = [
            student_id !== undefined ? "student_id = $1" : null,
            violation_type_id !== undefined ? "violation_type_id = $2" : null,
            reported_by !== undefined ? "reported_by = $3" : null,
            incident_date !== undefined ? "incident_date = $4" : null,
            description !== undefined ? "description = $5" : null,
            status !== undefined ? "status = $6" : null,
            required_service_hours !== undefined ? "required_service_hours = $7" : null,
            completed_service_hours !== undefined ? "completed_service_hours = $8" : null,
            cleared_at !== undefined ? "cleared_at = $9" : null
        ].filter(Boolean);

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No violation fields provided for update"
            });
        }

        const values = [
            student_id,
            violation_type_id,
            reported_by,
            incident_date,
            description,
            status,
            required_service_hours,
            completed_service_hours,
            cleared_at,
            id
        ].filter((value, index) => {
            const provided = [
                student_id !== undefined,
                violation_type_id !== undefined,
                reported_by !== undefined,
                incident_date !== undefined,
                description !== undefined,
                status !== undefined,
                required_service_hours !== undefined,
                completed_service_hours !== undefined,
                cleared_at !== undefined
            ];
            return provided[index];
        }).concat(id);

        const result = await pool.query(
            `UPDATE violations SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        return res.json({
            success: true,
            violation: result.rows[0]
        });
    } catch (error) {
        console.error("Update violation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update violation"
        });
    }
};

const deleteViolation = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM violations WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        return res.json({
            success: true,
            message: "Violation deleted successfully"
        });
    } catch (error) {
        console.error("Delete violation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete violation"
        });
    }
};

module.exports = {
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation
};
