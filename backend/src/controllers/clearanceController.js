const pool = require("../config/database");

const getClearanceRecords = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM student_clearance
            ORDER BY academic_year DESC, semester DESC, id DESC
        `);

        res.json({
            success: true,
            clearanceRecords: result.rows
        });
    } catch (error) {
        console.error("Get clearance records error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get clearance records"
        });
    }
};

const getClearanceRecordById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM student_clearance WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clearance record not found"
            });
        }

        return res.json({
            success: true,
            clearanceRecord: result.rows[0]
        });
    } catch (error) {
        console.error("Get clearance record by id error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get clearance record"
        });
    }
};

const createClearanceRecord = async (req, res) => {
    try {
        const {
            student_id,
            academic_year,
            semester,
            status,
            has_active_violation,
            has_pending_service,
            cleared_by,
            cleared_at,
            remarks
        } = req.body;

        if (!student_id || !academic_year || !semester) {
            return res.status(400).json({
                success: false,
                message: "student_id, academic_year, and semester are required"
            });
        }

        const result = await pool.query(
            `
                INSERT INTO student_clearance (
                    student_id,
                    academic_year,
                    semester,
                    status,
                    has_active_violation,
                    has_pending_service,
                    cleared_by,
                    cleared_at,
                    remarks
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
            [
                student_id,
                academic_year,
                semester,
                status || "NOT_ELIGIBLE",
                has_active_violation !== undefined ? has_active_violation : false,
                has_pending_service !== undefined ? has_pending_service : false,
                cleared_by || null,
                cleared_at || null,
                remarks || null
            ]
        );

        return res.status(201).json({
            success: true,
            clearanceRecord: result.rows[0]
        });
    } catch (error) {
        console.error("Create clearance record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create clearance record"
        });
    }
};

const updateClearanceRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            student_id,
            academic_year,
            semester,
            status,
            has_active_violation,
            has_pending_service,
            cleared_by,
            cleared_at,
            remarks
        } = req.body;

        const fields = [
            student_id !== undefined ? "student_id = $1" : null,
            academic_year !== undefined ? "academic_year = $2" : null,
            semester !== undefined ? "semester = $3" : null,
            status !== undefined ? "status = $4" : null,
            has_active_violation !== undefined ? "has_active_violation = $5" : null,
            has_pending_service !== undefined ? "has_pending_service = $6" : null,
            cleared_by !== undefined ? "cleared_by = $7" : null,
            cleared_at !== undefined ? "cleared_at = $8" : null,
            remarks !== undefined ? "remarks = $9" : null
        ].filter(Boolean);

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No clearance fields provided for update"
            });
        }

        const values = [
            student_id,
            academic_year,
            semester,
            status,
            has_active_violation,
            has_pending_service,
            cleared_by,
            cleared_at,
            remarks,
            id
        ].filter((value, index) => {
            const provided = [
                student_id !== undefined,
                academic_year !== undefined,
                semester !== undefined,
                status !== undefined,
                has_active_violation !== undefined,
                has_pending_service !== undefined,
                cleared_by !== undefined,
                cleared_at !== undefined,
                remarks !== undefined
            ];
            return provided[index];
        }).concat(id);

        const result = await pool.query(
            `UPDATE student_clearance SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clearance record not found"
            });
        }

        return res.json({
            success: true,
            clearanceRecord: result.rows[0]
        });
    } catch (error) {
        console.error("Update clearance record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update clearance record"
        });
    }
};

const deleteClearanceRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM student_clearance WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Clearance record not found"
            });
        }

        return res.json({
            success: true,
            message: "Clearance record deleted successfully"
        });
    } catch (error) {
        console.error("Delete clearance record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete clearance record"
        });
    }
};

module.exports = {
    getClearanceRecords,
    getClearanceRecordById,
    createClearanceRecord,
    updateClearanceRecord,
    deleteClearanceRecord
};
