const pool = require("../config/database");
const { recordAuditLog } = require("./auditController");
const {
    syncClearanceStatusForStudent
} = require("./clearanceController");


// =====================================================
// GET ALL VIOLATIONS
// =====================================================

const getViolations = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM violations
            ORDER BY incident_date DESC, id DESC
        `);

        return res.json({
            success: true,
            violations: result.rows
        });

    } catch (error) {
        console.error(
            "Get violations error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get violations"
        });
    }
};


// =====================================================
// GET VIOLATION BY ID
// =====================================================

const getViolationById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT *
            FROM violations
            WHERE id = $1
            `,
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
        console.error(
            "Get violation by id error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get violation"
        });
    }
};


// =====================================================
// CREATE VIOLATION
// =====================================================
// Flow:
//
// CREATE VIOLATION
//       ↓
// CREATE COMMUNITY SERVICE ASSIGNMENT
//       ↓
// SYNCHRONIZE CLEARANCE
//       ↓
// RETURN VIOLATION + ASSIGNMENT + CLEARANCE SYNC
//
// A community service assignment is automatically
// created whenever required_service_hours > 0.
// =====================================================

const createViolation = async (req, res) => {
    const client = await pool.connect();

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

        if (
            !student_id ||
            !violation_type_id ||
            !incident_date
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "student_id, violation_type_id, and incident_date are required"
            });
        }

        const requiredHours = Number(
            required_service_hours || 0
        );

        const completedHours = Number(
            completed_service_hours || 0
        );

        if (
            !Number.isFinite(requiredHours) ||
            requiredHours < 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "required_service_hours must be a valid non-negative number"
            });
        }

        if (
            !Number.isFinite(completedHours) ||
            completedHours < 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "completed_service_hours must be a valid non-negative number"
            });
        }

        if (completedHours > requiredHours) {
            return res.status(400).json({
                success: false,
                message:
                    "completed_service_hours cannot exceed required_service_hours"
            });
        }

        await client.query("BEGIN");

        // -------------------------------------------------
        // Create violation
        // -------------------------------------------------

        const result = await client.query(
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
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9
            )
            RETURNING *
            `,
            [
                student_id,
                violation_type_id,
                reported_by || null,
                incident_date,
                description || null,
                status || "OPEN",
                requiredHours,
                completedHours,
                cleared_at || null
            ]
        );

        const violation = result.rows[0];

        // -------------------------------------------------
        // Automatically create community service
        // assignment when service hours are required.
        // -------------------------------------------------

        let assignment = null;

        if (requiredHours > 0) {
            const remainingHours = Math.max(
                requiredHours - completedHours,
                0
            );

            const assignmentStatus =
                remainingHours <= 0
                    ? "COMPLETED"
                    : "OPEN";

            const completedAt =
                remainingHours <= 0
                    ? new Date()
                    : null;

            const assignmentResult =
                await client.query(
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
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                    )
                    RETURNING *
                    `,
                    [
                        violation.id,
                        violation.student_id,
                        requiredHours,
                        completedHours,
                        remainingHours,
                        assignmentStatus,
                        completedAt
                    ]
                );

            assignment =
                assignmentResult.rows[0];
        }

        // -------------------------------------------------
        // Commit violation + assignment
        // -------------------------------------------------

        await client.query("COMMIT");

        // -------------------------------------------------
        // Synchronize clearance
        // -------------------------------------------------
        //
        // This is performed after the transaction so the
        // clearance check can see the newly created
        // violation and community-service assignment.
        // -------------------------------------------------

        const clearanceSync =
            await syncClearanceStatusForStudent(
                violation.student_id
            );

        // -------------------------------------------------
        // Audit log
        // -------------------------------------------------

        await recordAuditLog(
            req.user.id,
            "CREATE",
            "violations",
            violation.id,
            `Created violation for student ID ${violation.student_id}`,
            req.ip
        );

        // -------------------------------------------------
        // Return result
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            violation,
            assignment,
            clearanceSync
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }

        console.error(
            "Create violation error:",
            error
        );

        // Handle duplicate assignment/violation
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "A related community service assignment already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Failed to create violation",
            error: error.message
        });

    } finally {
        client.release();
    }
};


// =====================================================
// UPDATE VIOLATION
// =====================================================
// Updates the violation and keeps its community-service
// assignment synchronized.
//
// =====================================================

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

                updates.push(
                    `${field} = $${values.length}`
                );
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "No violation fields provided for update"
            });
        }

        values.push(id);

        const result = await pool.query(
            `
            UPDATE violations
            SET
                ${updates.join(", ")},
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

        // -------------------------------------------------
        // Synchronize community service assignment
        // -------------------------------------------------

        let assignment = null;

        const assignmentResult = await pool.query(
            `
            SELECT *
            FROM community_service_assignments
            WHERE violation_id = $1
            `,
            [violation.id]
        );

        if (assignmentResult.rows.length > 0) {
            const existingAssignment =
                assignmentResult.rows[0];

            const requiredHours = Number(
                violation.required_service_hours || 0
            );

            const completedHours = Number(
                violation.completed_service_hours || 0
            );

            const remainingHours = Math.max(
                requiredHours - completedHours,
                0
            );

            const newStatus =
                remainingHours <= 0
                    ? "COMPLETED"
                    : "OPEN";

            const completedAt =
                remainingHours <= 0
                    ? existingAssignment.completed_at ||
                      new Date()
                    : null;

            const updatedAssignment =
                await pool.query(
                    `
                    UPDATE community_service_assignments
                    SET
                        student_id = $1,
                        required_hours = $2,
                        completed_hours = $3,
                        remaining_hours = $4,
                        status = $5,
                        completed_at = $6
                    WHERE violation_id = $7
                    RETURNING *
                    `,
                    [
                        violation.student_id,
                        requiredHours,
                        completedHours,
                        remainingHours,
                        newStatus,
                        completedAt,
                        violation.id
                    ]
                );

            assignment =
                updatedAssignment.rows[0];

        } else if (
    Number(
        violation.required_service_hours || 0
    ) > 0
) {

    console.log(
        "AUTO ASSIGNMENT TRIGGERED:",
        {
            violation_id: violation.id,
            student_id: violation.student_id,
            required_service_hours:
                violation.required_service_hours,
            completed_service_hours:
                violation.completed_service_hours
        }
    );

    const requiredHours = Number(
        violation.required_service_hours
    );

    const completedHours = Number(
        violation.completed_service_hours || 0
    );

    const remainingHours = Math.max(
        requiredHours - completedHours,
        0
    );

    const assignmentResult =
        await pool.query(
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
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            RETURNING *
            `,
            [
                violation.id,
                violation.student_id,
                requiredHours,
                completedHours,
                remainingHours,
                remainingHours <= 0
                    ? "COMPLETED"
                    : "OPEN",
                remainingHours <= 0
                    ? new Date()
                    : null
            ]
        );

    assignment =
        assignmentResult.rows[0];

    console.log(
        "AUTO ASSIGNMENT CREATED:",
        assignment
    );
}

        // -------------------------------------------------
        // Synchronize clearance
        // -------------------------------------------------

        const clearanceSync =
            await syncClearanceStatusForStudent(
                violation.student_id
            );

        // -------------------------------------------------
        // Audit log
        // -------------------------------------------------

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
            violation,
            assignment,
            clearanceSync
        });

    } catch (error) {
        console.error(
            "Update violation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to update violation",
            error: error.message
        });
    }
};


// =====================================================
// DELETE VIOLATION
// =====================================================

const deleteViolation = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM violations
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        const violation = result.rows[0];

        // Community-service assignment is automatically
        // removed by the database foreign key:
        // ON DELETE CASCADE.

        const clearanceSync =
            await syncClearanceStatusForStudent(
                violation.student_id
            );

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
            message:
                "Violation deleted successfully",
            clearanceSync
        });

    } catch (error) {
        console.error(
            "Delete violation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete violation",
            error: error.message
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation
};