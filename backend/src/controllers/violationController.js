const pool = require("../config/database");
const { recordAuditLog } = require("./auditController");

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

      const violation = result.rows[0];

    await recordAuditLog(
    req.user.id,
    "CREATE",
    "violations",
    violation.id,
    `Created violation for student ID ${violation.student_id}`,
    req.ip
);

    return res.status(201).json({
    success: true,
    violation
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

        const allowedFields = [
            "student_id",
            "violation_type_id",
            "reported_by",
            "incident_date",
            "description",
            "status",
            "required_service_hours",
            "completed_service_hours",
            "cleared_at"
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                values.push(req.body[field]);
                updates.push(`${field} = $${values.length}`);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No violation fields provided for update"
            });
        }

        values.push(id);

        const result = await pool.query(
            `
                UPDATE violations
                SET ${updates.join(", ")},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        const violation = result.rows[0];

        await recordAuditLog(
            req.user.id,
            "UPDATE",
            "violations",
            violation.id,
            `Updated violation for student ID ${violation.student_id}`,
            req.ip
        );

        return res.json({
            success: true,
            violation
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

      const violation = result.rows[0];

await recordAuditLog(
    req.user.id,
    "DELETE",
    "violations",
    violation.id,
    `Deleted violation for student ID ${violation.student_id}`,
    req.ip
);

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
