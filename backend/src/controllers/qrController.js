const pool = require("../config/database");
const {
    syncClearanceStatusForStudent
} = require("./clearanceController");

// =====================================================
// SCAN QR CODE
// =====================================================
const scanQrCode = async (req, res) => {
    try {
        const {
            qr_code,
            scanned_by,
            department_id
        } = req.body;

        if (!qr_code || !scanned_by || !department_id) {
            return res.status(400).json({
                success: false,
                message:
                    "qr_code, scanned_by, and department_id are required"
            });
        }

        const studentResult = await pool.query(
            `
            SELECT
                id,
                student_number,
                first_name,
                last_name,
                qr_code
            FROM students
            WHERE qr_code = $1
            `,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found for this QR code"
            });
        }

        const student = studentResult.rows[0];

        const assignmentResult = await pool.query(
            `
            SELECT
                id,
                violation_id,
                required_hours,
                completed_hours,
                remaining_hours,
                status
            FROM community_service_assignments
            WHERE student_id = $1
              AND status IN ('OPEN', 'IN_PROGRESS')
            ORDER BY id DESC
            LIMIT 1
            `,
            [student.id]
        );

        const assignment =
            assignmentResult.rows[0] || null;

        return res.json({
            success: true,
            message: "QR code scanned successfully",

            student: {
                id: student.id,
                student_number: student.student_number,
                first_name: student.first_name,
                last_name: student.last_name,
                qr_code: student.qr_code
            },

            assignment
        });

    } catch (error) {
        console.error(
            "Scan QR code error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to scan QR code",
            error: error.message
        });
    }
};


// =====================================================
// QR TIME-IN
// =====================================================
const timeIn = async (req, res) => {
    try {
        const {
            qr_code,
            scanned_by,
            department_id,
            notes
        } = req.body;

        if (!qr_code || !scanned_by || !department_id) {
            return res.status(400).json({
                success: false,
                message:
                    "qr_code, scanned_by, and department_id are required"
            });
        }

        // -------------------------------------------------
        // Find student
        // -------------------------------------------------
        const studentResult = await pool.query(
            `
            SELECT
                id,
                student_number,
                first_name,
                last_name,
                qr_code
            FROM students
            WHERE qr_code = $1
            `,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = studentResult.rows[0];

        // -------------------------------------------------
        // Find active community service assignment
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
            WHERE student_id = $1
              AND status IN ('OPEN', 'IN_PROGRESS')
            ORDER BY id DESC
            LIMIT 1
            `,
            [student.id]
        );

        if (assignmentResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Student has no active community service assignment"
            });
        }

        const assignment =
            assignmentResult.rows[0];

        // -------------------------------------------------
        // Prevent duplicate active TIME-IN
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
            [
                assignment.id,
                student.id
            ]
        );

        if (activeResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Student already has an active community service time-in",
                attendance:
                    activeResult.rows[0]
            });
        }

        // -------------------------------------------------
        // Record community service TIME-IN
        // -------------------------------------------------
        const attendanceResult = await pool.query(
            `
            INSERT INTO community_service_attendance (
                assignment_id,
                student_id,
                department_id,
                scanned_by,
                attendance_type,
                notes
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'TIME_IN',
                $5
            )
            RETURNING *
            `,
            [
                assignment.id,
                student.id,
                department_id,
                scanned_by,
                notes || null
            ]
        );

        // -------------------------------------------------
        // Record QR scan log
        // -------------------------------------------------
        const qrLogResult = await pool.query(
            `
            INSERT INTO qr_scan_logs (
                student_id,
                scanned_by,
                department_id,
                scan_type,
                device_information,
                ip_address
            )
            VALUES (
                $1,
                $2,
                $3,
                'TIME_IN',
                $4,
                $5
            )
            RETURNING *
            `,
            [
                student.id,
                scanned_by,
                department_id,
                notes || null,
                req.ip || null
            ]
        );

        return res.status(201).json({
            success: true,
            message:
                "Community service QR time-in recorded successfully",

            student: {
                id: student.id,
                student_number: student.student_number,
                first_name: student.first_name,
                last_name: student.last_name
            },

            studentId: student.id,

            assignment,

            attendance:
                attendanceResult.rows[0],

            scanLog:
                qrLogResult.rows[0]
        });

    } catch (error) {
        console.error(
            "QR time-in error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to record QR community service time-in",
            error: error.message
        });
    }
};


// =====================================================
// QR TIME-OUT
// =====================================================
const timeOut = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            qr_code,
            scanned_by,
            department_id,
            notes
        } = req.body;

        if (!qr_code || !scanned_by || !department_id) {
            return res.status(400).json({
                success: false,
                message:
                    "qr_code, scanned_by, and department_id are required"
            });
        }

        await client.query("BEGIN");

        // -------------------------------------------------
        // Find student
        // -------------------------------------------------
        const studentResult = await client.query(
            `
            SELECT
                id,
                student_number,
                first_name,
                last_name,
                qr_code
            FROM students
            WHERE qr_code = $1
            `,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = studentResult.rows[0];

        // -------------------------------------------------
        // Find active assignment
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
            WHERE student_id = $1
              AND status IN ('OPEN', 'IN_PROGRESS')
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [student.id]
        );

        if (assignmentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Student has no active community service assignment"
            });
        }

        const assignment =
            assignmentResult.rows[0];

        // -------------------------------------------------
        // Find latest unmatched TIME-IN
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
            [
                assignment.id,
                student.id
            ]
        );

        if (timeInResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "No active community service time-in found"
            });
        }

        const timeIn =
            timeInResult.rows[0];

        // -------------------------------------------------
        // Insert TIME-OUT
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
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'TIME_OUT',
                $5
            )
            RETURNING *
            `,
            [
                assignment.id,
                student.id,
                department_id,
                scanned_by,
                notes || null
            ]
        );

        const timeOutRecord =
            timeOutResult.rows[0];

        // -------------------------------------------------
        // Calculate hours
        // -------------------------------------------------
        const durationResult = await client.query(
            `
            SELECT
                EXTRACT(
                    EPOCH FROM (
                        $2::timestamptz -
                        $1::timestamptz
                    )
                ) / 3600 AS hours
            `,
            [
                timeIn.scanned_at,
                timeOutRecord.scanned_at
            ]
        );

        let hoursWorked =
            Number(durationResult.rows[0].hours);

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

        hoursWorked =
            Math.round(hoursWorked * 100) / 100;

        const currentCompleted =
            Number(assignment.completed_hours || 0);

        const requiredHours =
            Number(assignment.required_hours || 0);

        const newCompleted =
            Math.min(
                currentCompleted + hoursWorked,
                requiredHours
            );

        const newRemaining =
            Math.max(
                requiredHours - newCompleted,
                0
            );

        const newStatus =
            newRemaining <= 0
                ? "COMPLETED"
                : "IN_PROGRESS";

        const completedAt =
            newStatus === "COMPLETED"
                ? new Date()
                : null;

        // -------------------------------------------------
        // Update assignment
        // -------------------------------------------------
        const updateResult =
            await client.query(
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
                    assignment.id
                ]
            );

        const updatedAssignment =
            updateResult.rows[0];

        // -------------------------------------------------
        // Synchronize violation
        // -------------------------------------------------
        const violationResult =
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

        if (violationResult.rows.length === 0) {
            throw new Error(
                `Violation ${assignment.violation_id} not found`
            );
        }

        const updatedViolation =
            violationResult.rows[0];

        // -------------------------------------------------
        // Record QR scan
        // -------------------------------------------------
        const qrLogResult =
            await client.query(
                `
                INSERT INTO qr_scan_logs (
                    student_id,
                    scanned_by,
                    department_id,
                    scan_type,
                    device_information,
                    ip_address
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'TIME_OUT',
                    $4,
                    $5
                )
                RETURNING *
                `,
                [
                    student.id,
                    scanned_by,
                    department_id,
                    notes || null,
                    req.ip || null
                ]
            );

        await client.query("COMMIT");

        // -------------------------------------------------
        // Synchronize clearance AFTER COMMIT
        // -------------------------------------------------
        const clearanceSync =
            await syncClearanceStatusForStudent(
                student.id
            );

        return res.status(201).json({
            success: true,

            message:
                "Community service QR time-out recorded successfully",

            hours_worked: hoursWorked,

            student: {
                id: student.id,
                student_number: student.student_number,
                first_name: student.first_name,
                last_name: student.last_name
            },

            studentId: student.id,

            assignment:
                updatedAssignment,

            violation:
                updatedViolation,

            clearanceSync,

            attendance:
                timeOutRecord,

            scanLog:
                qrLogResult.rows[0]
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
            "QR time-out error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to record QR community service time-out",
            error: error.message
        });

    } finally {
        client.release();
    }
};


// =====================================================
// EXPORTS
// =====================================================
module.exports = {
    scanQrCode,
    timeIn,
    timeOut
};
