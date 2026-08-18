const {
    syncClearanceStatusForStudent
} = require("./clearanceController");
const pool = require("../config/database");

// =====================================================
// COMMUNITY SERVICE TIME-IN
// =====================================================
const communityServiceTimeIn = async (req, res) => {
    try {
        const {
            assignment_id,
            student_id,
            department_id,
            scanned_by,
            notes
        } = req.body;

        if (
            !assignment_id ||
            !student_id ||
            !department_id ||
            !scanned_by
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "assignment_id, student_id, department_id, and scanned_by are required"
            });
        }

        // -------------------------------------------------
        // Get assignment
        // -------------------------------------------------
        const assignmentResult = await pool.query(
            `
            SELECT
                id,
                violation_id,
                student_id,
                required_hours,
                completed_hours,
                remaining_hours,
                status
            FROM community_service_assignments
            WHERE id = $1
            `,
            [assignment_id]
        );

        if (assignmentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Community service assignment not found"
            });
        }

        const assignment = assignmentResult.rows[0];

        // -------------------------------------------------
        // Verify assignment belongs to student
        // -------------------------------------------------
        if (Number(assignment.student_id) !== Number(student_id)) {
            return res.status(400).json({
                success: false,
                message:
                    "The assignment does not belong to the specified student"
            });
        }

        // -------------------------------------------------
        // Prevent time-in on completed assignment
        // -------------------------------------------------
        if (assignment.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message:
                    "This community service assignment is already completed"
            });
        }

        // -------------------------------------------------
        // Prevent duplicate active TIME_IN
        // -------------------------------------------------
        const activeResult = await pool.query(
            `
            SELECT
                ci.id,
                ci.scanned_at
            FROM community_service_attendance ci
            WHERE ci.assignment_id = $1
              AND ci.student_id = $2
              AND ci.attendance_type = 'TIME_IN'
              AND NOT EXISTS (
                  SELECT 1
                  FROM community_service_attendance co
                  WHERE co.assignment_id = ci.assignment_id
                    AND co.student_id = ci.student_id
                    AND co.attendance_type = 'TIME_OUT'
                    AND co.scanned_at > ci.scanned_at
              )
            ORDER BY ci.scanned_at DESC
            LIMIT 1
            `,
            [assignment_id, student_id]
        );

        if (activeResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Student already has an active community service time-in",
                attendance: activeResult.rows[0]
            });
        }

        // -------------------------------------------------
        // Insert TIME_IN
        // -------------------------------------------------
        const result = await pool.query(
            `
            INSERT INTO community_service_attendance (
                assignment_id,
                student_id,
                department_id,
                scanned_by,
                attendance_type,
                notes
            )
            VALUES ($1, $2, $3, $4, 'TIME_IN', $5)
            RETURNING *
            `,
            [
                assignment_id,
                student_id,
                department_id,
                scanned_by,
                notes || null
            ]
        );

        return res.status(201).json({
            success: true,
            message:
                "Community service time-in recorded successfully",
            attendance: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Community service time-in error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to record community service time-in",
            error: error.message
        });
    }
};


// =====================================================
// COMMUNITY SERVICE TIME-OUT
// =====================================================
const communityServiceTimeOut = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            assignment_id,
            student_id,
            department_id,
            scanned_by,
            notes
        } = req.body;

        if (
            !assignment_id ||
            !student_id ||
            !department_id ||
            !scanned_by
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "assignment_id, student_id, department_id, and scanned_by are required"
            });
        }

        await client.query("BEGIN");

        // -------------------------------------------------
        // Get assignment and lock the row
        // -------------------------------------------------
        const assignmentResult = await client.query(
            `
            SELECT
                id,
                violation_id,
                student_id,
                required_hours,
                completed_hours,
                remaining_hours,
                status
            FROM community_service_assignments
            WHERE id = $1
            FOR UPDATE
            `,
            [assignment_id]
        );

        if (assignmentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message:
                    "Community service assignment not found"
            });
        }

        const assignment = assignmentResult.rows[0];

        // -------------------------------------------------
        // Verify assignment belongs to student
        // -------------------------------------------------
        if (Number(assignment.student_id) !== Number(student_id)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "The assignment does not belong to the specified student"
            });
        }

        // -------------------------------------------------
        // Prevent time-out on completed assignment
        // -------------------------------------------------
        if (assignment.status === "COMPLETED") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "This community service assignment is already completed"
            });
        }

        // -------------------------------------------------
        // Find latest unmatched TIME_IN
        // -------------------------------------------------
        const timeInResult = await client.query(
            `
            SELECT
                ci.id,
                ci.scanned_at
            FROM community_service_attendance ci
            WHERE ci.assignment_id = $1
              AND ci.student_id = $2
              AND ci.attendance_type = 'TIME_IN'
              AND NOT EXISTS (
                  SELECT 1
                  FROM community_service_attendance co
                  WHERE co.assignment_id = ci.assignment_id
                    AND co.student_id = ci.student_id
                    AND co.attendance_type = 'TIME_OUT'
                    AND co.scanned_at > ci.scanned_at
              )
            ORDER BY ci.scanned_at DESC
            LIMIT 1
            `,
            [assignment_id, student_id]
        );

        if (timeInResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "No active community service time-in found"
            });
        }

        const timeIn = timeInResult.rows[0];

        // -------------------------------------------------
        // Insert TIME_OUT
        // -------------------------------------------------
        const timeOutResult = await client.query(
            `
            INSERT INTO community_service_attendance (
                assignment_id,
                student_id,
                department_id,
                scanned_by,
                attendance_type,
                notes
            )
            VALUES ($1, $2, $3, $4, 'TIME_OUT', $5)
            RETURNING *
            `,
            [
                assignment_id,
                student_id,
                department_id,
                scanned_by,
                notes || null
            ]
        );

        const timeOut = timeOutResult.rows[0];

        // -------------------------------------------------
        // Calculate worked hours
        // -------------------------------------------------
        const durationResult = await client.query(
            `
            SELECT
                EXTRACT(
                    EPOCH FROM ($2::timestamptz - $1::timestamptz)
                ) / 3600 AS hours
            `,
            [
                timeIn.scanned_at,
                timeOut.scanned_at
            ]
        );

        let hoursWorked = Number(
            durationResult.rows[0].hours
        );

        // -------------------------------------------------
        // Validate duration
        // -------------------------------------------------
        if (
            !Number.isFinite(hoursWorked) ||
            hoursWorked < 0
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Invalid time-in/time-out duration"
            });
        }

        // -------------------------------------------------
        // Round worked hours to 2 decimals
        // -------------------------------------------------
        hoursWorked =
            Math.round(hoursWorked * 100) / 100;

        const currentCompleted = Number(
            assignment.completed_hours || 0
        );

        const requiredHours = Number(
            assignment.required_hours || 0
        );

        // -------------------------------------------------
        // Calculate new service totals
        // -------------------------------------------------
        const newCompleted = Math.min(
            currentCompleted + hoursWorked,
            requiredHours
        );

        const newRemaining = Math.max(
            requiredHours - newCompleted,
            0
        );

        // -------------------------------------------------
        // Determine assignment status
        // -------------------------------------------------
        const newStatus =
            newRemaining <= 0
                ? "COMPLETED"
                : "IN_PROGRESS";

        const completedAt =
            newStatus === "COMPLETED"
                ? new Date()
                : null;

        // -------------------------------------------------
        // Update community service assignment
        // -------------------------------------------------
        const updateResult = await client.query(
            `
            UPDATE community_service_assignments
            SET
                completed_hours = $1,
                remaining_hours = $2,
                status = $3,
                completed_at = $4
            WHERE id = $5
            RETURNING *
            `,
            [
                newCompleted,
                newRemaining,
                newStatus,
                completedAt,
                assignment_id
            ]
        );

        const updatedAssignment =
            updateResult.rows[0];

        // =================================================
        // SYNCHRONIZE VIOLATION
        // =================================================
        //
        // The violation should always receive the
        // completed_hours from the updated assignment.
        //
        // If service is fully completed:
        //     violation status = COMPLETED
        //
        // Otherwise:
        //     keep the existing violation status.
        //
        // =================================================

        const violationUpdateResult =
            await client.query(
                `
                UPDATE violations
                SET
                    completed_service_hours = $1,
                    status = CASE
                        WHEN $1 >= required_service_hours
                            THEN 'COMPLETED'::violation_status
                        ELSE status
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING
                    id,
                    required_service_hours,
                    completed_service_hours,
                    status
                `,
                [
                    Number(
                        updatedAssignment.completed_hours
                    ),
                    assignment.violation_id
                ]
            );

        // -------------------------------------------------
        // Verify violation exists
        // -------------------------------------------------
        if (violationUpdateResult.rows.length === 0) {
            throw new Error(
                `Violation ${assignment.violation_id} not found while synchronizing service hours`
            );
        }

        const updatedViolation =
            violationUpdateResult.rows[0];
        console.log("SYNCED VIOLATION:", updatedViolation);
// -------------------------------------------------
// Commit transaction
// -------------------------------------------------
await client.query("COMMIT");

// -------------------------------------------------
// Synchronize clearance AFTER COMMIT
// -------------------------------------------------
// This must happen after COMMIT so the clearance
// query can see the completed assignment and violation.
// -------------------------------------------------

const clearanceSync =
    await syncClearanceStatusForStudent(
        student_id
    );

// -------------------------------------------------
// Return result
// -------------------------------------------------

return res.status(201).json({
    success: true,
    message:
        "Community service time-out recorded successfully",
    hours_worked: hoursWorked,
    assignment: updatedAssignment,
    violation: updatedViolation,
    clearanceSync,
    attendance: timeOut
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
            "Community service time-out error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to record community service time-out",
            error: error.message
        });

    } finally {
        client.release();
    }
};


// =====================================================
// GET ATTENDANCE FOR ASSIGNMENT
// =====================================================
const getCommunityServiceAttendance = async (
    req,
    res
) => {
    try {
        const { assignmentId } = req.params;

        const result = await pool.query(
            `
            SELECT
                csa.id,
                csa.assignment_id,
                csa.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                csa.department_id,
                d.department_name,
                csa.scanned_by,
                csa.attendance_type,
                csa.scanned_at,
                csa.notes
            FROM community_service_attendance csa
            JOIN students s
                ON csa.student_id = s.id
            JOIN departments d
                ON csa.department_id = d.id
            WHERE csa.assignment_id = $1
            ORDER BY
                csa.scanned_at DESC,
                csa.id DESC
            `,
            [assignmentId]
        );

        return res.json({
            success: true,
            assignment_id: Number(assignmentId),
            total_records: result.rows.length,
            attendance: result.rows
        });

    } catch (error) {
        console.error(
            "Get community service attendance error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to get community service attendance",
            error: error.message
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================
module.exports = {
    communityServiceTimeIn,
    communityServiceTimeOut,
    getCommunityServiceAttendance
};