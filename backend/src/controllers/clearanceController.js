const pool = require("../config/database");


// =====================================================
// CHECK CLEARANCE ELIGIBILITY
// =====================================================
// Returns the student's current clearance eligibility.
//
// NOT_ELIGIBLE:
// - Has an OPEN violation
// - OR has incomplete community service
//
// PENDING:
// - No active violation
// - No pending service
// - Waiting for Department Head approval
//
// CLEARED:
// - Department Head has approved the clearance
// =====================================================

const getStudentClearanceEligibility = async (studentId, executor = pool) => {
    // -------------------------------------------------
    // Check active violations
    // -------------------------------------------------

    const activeViolationResult = await executor.query(
        `
        SELECT COUNT(*) AS count
        FROM violations
        WHERE student_id = $1
          AND status = 'OPEN'
        `,
        [studentId]
    );

    const hasActiveViolation =
        Number(activeViolationResult.rows[0].count) > 0;


    // -------------------------------------------------
    // Check pending community service
    // -------------------------------------------------

    const pendingServiceResult = await executor.query(
        `
        SELECT COUNT(*) AS count
        FROM community_service_assignments
        WHERE student_id = $1
          AND status IN ('OPEN', 'IN_PROGRESS')
          AND remaining_hours > 0
        `,
        [studentId]
    );

    const hasPendingService =
        Number(pendingServiceResult.rows[0].count) > 0;


    // -------------------------------------------------
    // Determine eligibility
    // -------------------------------------------------

    const eligible =
        !hasActiveViolation &&
        !hasPendingService;

    return {
        hasActiveViolation,
        hasPendingService,
        eligible
    };
};


// =====================================================
// SYNCHRONIZE EXISTING CLEARANCE RECORDS
// =====================================================

const syncClearanceStatusForStudent = async (studentId, executor = pool) => {
    const eligibility =
        await getStudentClearanceEligibility(studentId, executor);


    // -------------------------------------------------
    // Find clearance records
    // -------------------------------------------------

    const clearanceResult = await executor.query(
        `
        SELECT
            id,
            status
        FROM student_clearance
        WHERE student_id = $1
        ORDER BY id
        `,
        [studentId]
    );


    // -------------------------------------------------
    // No records to synchronize
    // -------------------------------------------------

    if (clearanceResult.rows.length === 0) {
        return {
            updated: false,
            records: [],
            ...eligibility
        };
    }


    const updatedRecords = [];


    for (const clearance of clearanceResult.rows) {
        let newStatus;


        // -------------------------------------------------
        // Student has unresolved requirements
        // -------------------------------------------------

        if (
            eligibility.hasActiveViolation ||
            eligibility.hasPendingService
        ) {
            newStatus = "NOT_ELIGIBLE";
        }


        // -------------------------------------------------
        // Student is already approved and remains eligible
        // -------------------------------------------------

        else if (clearance.status === "CLEARED") {
            newStatus = "CLEARED";
        }


        // -------------------------------------------------
        // Student is eligible and waiting for approval
        // -------------------------------------------------

        else {
            newStatus = "PENDING";
        }


        // -------------------------------------------------
        // Clear approval metadata whenever the record is
        // no longer CLEARED.
        // -------------------------------------------------

        const approvalFields =
            newStatus === "CLEARED"
                ? `
                    cleared_by = cleared_by,
                    cleared_at = cleared_at
                  `
                : `
                    cleared_by = NULL,
                    cleared_at = NULL
                  `;


        const result = await executor.query(
            `
            UPDATE student_clearance
            SET
                status = $1,
                has_active_violation = $2,
                has_pending_service = $3,
                ${approvalFields},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
            `,
            [
                newStatus,
                eligibility.hasActiveViolation,
                eligibility.hasPendingService,
                clearance.id
            ]
        );

        updatedRecords.push(result.rows[0]);
    }


    return {
        updated: true,
        records: updatedRecords,
        ...eligibility
    };
};


// =====================================================
// GET MY CLEARANCE RECORDS
// =====================================================
// STUDENT ONLY.
//
// Uses req.user.id from the authenticated JWT.
//
// User ID -> students.user_id -> students.id
// =====================================================
// =====================================================
// GET MY CLEARANCE ELIGIBILITY
// =====================================================
// STUDENT ONLY.
//
// Uses req.user.id from the authenticated JWT.
//
// User ID -> students.user_id -> students.id
//
// The student cannot provide another student's ID.
// =====================================================

const getMyClearanceEligibility = async (req, res) => {
    try {
        const userId = req.user.id;


        // -------------------------------------------------
        // Find the logged-in student's student record
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
            LIMIT 1
            `,
            [userId]
        );


        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student record not found"
            });
        }


        const student = studentResult.rows[0];


        // -------------------------------------------------
        // Calculate current eligibility
        // -------------------------------------------------

        const eligibility =
            await getStudentClearanceEligibility(
                student.id
            );


        return res.json({
            success: true,

            student_id: Number(student.id),

            student: {
                student_number:
                    student.student_number,

                first_name:
                    student.first_name,

                last_name:
                    student.last_name
            },

            ...eligibility
        });

    } catch (error) {
        console.error(
            "Get my clearance eligibility error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to determine your clearance eligibility",
            error: error.message
        });
    }
};


const getMyClearanceRecords = async (req, res) => {
    try {
        const userId = req.user.id;


        // -------------------------------------------------
        // Find logged-in student's student record
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
            LIMIT 1
            `,
            [userId]
        );


        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student record not found"
            });
        }


        const student = studentResult.rows[0];


        // -------------------------------------------------
        // Get student's clearance records
        // -------------------------------------------------

        const clearanceResult = await pool.query(
            `
            SELECT
                sc.*,
                s.student_number,
                s.first_name,
                s.last_name
            FROM student_clearance sc
            JOIN students s
                ON sc.student_id = s.id
            WHERE sc.student_id = $1
            ORDER BY
                sc.academic_year DESC,
                sc.semester DESC,
                sc.id DESC
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
            clearanceRecords: clearanceResult.rows
        });

    } catch (error) {
        console.error(
            "Get my clearance records error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to get student clearance records",
            error: error.message
        });
    }
};


// =====================================================
// GET ALL CLEARANCE RECORDS
// =====================================================
// ADMIN / DISCIPLINE OFFICE / DEPARTMENT HEAD
// =====================================================

const getClearanceRecords = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                sc.*,
                s.student_number,
                s.first_name,
                s.last_name
            FROM student_clearance sc
            JOIN students s
                ON sc.student_id = s.id
            ORDER BY
                sc.academic_year DESC,
                sc.semester DESC,
                sc.id DESC
            `
        );


        return res.json({
            success: true,
            clearanceRecords: result.rows
        });

    } catch (error) {
        console.error(
            "Get clearance records error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to get clearance records",
            error: error.message
        });
    }
};


// =====================================================
// GET CLEARANCE RECORD BY ID
// =====================================================

const getClearanceRecordById = async (req, res) => {
    try {
        const { id } = req.params;


        const result = await pool.query(
            `
            SELECT
                sc.*,
                s.student_number,
                s.first_name,
                s.last_name
            FROM student_clearance sc
            JOIN students s
                ON sc.student_id = s.id
            WHERE sc.id = $1
            `,
            [id]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Clearance record not found"
            });
        }


        return res.json({
            success: true,
            clearanceRecord: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Get clearance record by id error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to get clearance record",
            error: error.message
        });
    }
};


// =====================================================
// GET STUDENT CLEARANCE ELIGIBILITY
// =====================================================

const getStudentClearanceEligibilityController =
    async (req, res) => {
        try {
            const { studentId } = req.params;


            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "studentId is required"
                });
            }


            const eligibility =
                await getStudentClearanceEligibility(
                    studentId
                );


            return res.json({
                success: true,
                student_id: Number(studentId),
                ...eligibility
            });

        } catch (error) {
            console.error(
                "Get clearance eligibility error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to determine clearance eligibility"
            });
        }
    };


// =====================================================
// CREATE CLEARANCE RECORD
// =====================================================

const createClearanceRecord = async (req, res) => {
    try {
        const {
            student_id,
            academic_year,
            semester,
            remarks
        } = req.body;


        // -------------------------------------------------
        // Validate required fields
        // -------------------------------------------------

        if (
            !student_id ||
            !academic_year ||
            !semester
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "student_id, academic_year, and semester are required"
            });
        }


        // -------------------------------------------------
        // Calculate eligibility
        // -------------------------------------------------

        const eligibility =
            await getStudentClearanceEligibility(
                student_id
            );


        const calculatedStatus =
            eligibility.eligible
                ? "PENDING"
                : "NOT_ELIGIBLE";


        // -------------------------------------------------
        // Create record
        // -------------------------------------------------

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
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                NULL,
                NULL,
                $7
            )
            RETURNING *
            `,
            [
                student_id,
                academic_year,
                semester,
                calculatedStatus,
                eligibility.hasActiveViolation,
                eligibility.hasPendingService,
                remarks || null
            ]
        );


        return res.status(201).json({
            success: true,
            message:
                "Clearance record created successfully",
            clearanceRecord: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Create clearance record error:",
            error
        );


        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "A clearance record already exists for this student, academic year, and semester"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Failed to create clearance record",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE CLEARANCE RECORD
// =====================================================

const updateClearanceRecord = async (req, res) => {
    try {
        const { id } = req.params;


        const {
            student_id,
            academic_year,
            semester,
            has_active_violation,
            has_pending_service,
            remarks,
            status,
            cleared_by,
            cleared_at
        } = req.body;


        // -------------------------------------------------
        // Prevent bypassing approval workflow
        // -------------------------------------------------

        if (
            status !== undefined ||
            cleared_by !== undefined ||
            cleared_at !== undefined
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Clearance status and approval fields can only be changed through the approval workflow"
            });
        }


        const updates = [];
        const values = [];


        // -------------------------------------------------
        // Allowed editable fields
        // -------------------------------------------------

        if (student_id !== undefined) {
            values.push(student_id);

            updates.push(
                `student_id = $${values.length}`
            );
        }


        if (academic_year !== undefined) {
            values.push(academic_year);

            updates.push(
                `academic_year = $${values.length}`
            );
        }


        if (semester !== undefined) {
            values.push(semester);

            updates.push(
                `semester = $${values.length}`
            );
        }


        if (
            has_active_violation !== undefined
        ) {
            values.push(has_active_violation);

            updates.push(
                `has_active_violation = $${values.length}`
            );
        }


        if (
            has_pending_service !== undefined
        ) {
            values.push(has_pending_service);

            updates.push(
                `has_pending_service = $${values.length}`
            );
        }


        if (remarks !== undefined) {
            values.push(remarks);

            updates.push(
                `remarks = $${values.length}`
            );
        }


        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "No editable clearance fields provided for update"
            });
        }


        // -------------------------------------------------
        // Add record ID
        // -------------------------------------------------

        values.push(id);


        const result = await pool.query(
            `
            UPDATE student_clearance
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
                message:
                    "Clearance record not found"
            });
        }


        return res.json({
            success: true,
            message:
                "Clearance record updated successfully",
            clearanceRecord: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Update clearance record error:",
            error
        );


        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "A clearance record already exists for this student, academic year, and semester"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Failed to update clearance record",
            error: error.message
        });
    }
};


// =====================================================
// APPROVE CLEARANCE
// =====================================================
// Department Head only.
// =====================================================

const approveClearanceRecord = async (req, res) => {
    try {
        const { id } = req.params;


        // -------------------------------------------------
        // Role verification
        // -------------------------------------------------

        if (req.user.role !== "DEPARTMENT_HEAD") {
            return res.status(403).json({
                success: false,
                message:
                    "Only the Department Head can approve clearance"
            });
        }


        // -------------------------------------------------
        // Get clearance
        // -------------------------------------------------

        const clearanceResult = await pool.query(
            `
            SELECT *
            FROM student_clearance
            WHERE id = $1
            `,
            [id]
        );


        if (clearanceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Clearance record not found"
            });
        }


        const clearance =
            clearanceResult.rows[0];


        // -------------------------------------------------
        // Prevent duplicate approval
        // -------------------------------------------------

        if (clearance.status === "CLEARED") {
            return res.status(409).json({
                success: false,
                message:
                    "Clearance record is already CLEARED"
            });
        }


        // -------------------------------------------------
        // Recheck current eligibility
        // -------------------------------------------------

        const eligibility =
            await getStudentClearanceEligibility(
                clearance.student_id
            );


        // -------------------------------------------------
        // Refuse approval if unresolved
        // -------------------------------------------------

        if (
            eligibility.hasActiveViolation ||
            eligibility.hasPendingService
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Student is not eligible for clearance approval",
                hasActiveViolation:
                    eligibility.hasActiveViolation,
                hasPendingService:
                    eligibility.hasPendingService
            });
        }


        // -------------------------------------------------
        // Approve
        // -------------------------------------------------

        const result = await pool.query(
            `
            UPDATE student_clearance
            SET
                status = 'CLEARED',
                has_active_violation = false,
                has_pending_service = false,
                cleared_by = $1,
                cleared_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [
                req.user.id,
                id
            ]
        );


        return res.json({
            success: true,
            message:
                "Clearance approved successfully",
            clearanceRecord: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Approve clearance error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to approve clearance",
            error: error.message
        });
    }
};


// =====================================================
// DELETE CLEARANCE RECORD
// =====================================================

const deleteClearanceRecord = async (req, res) => {
    try {
        const { id } = req.params;


        const result = await pool.query(
            `
            DELETE FROM student_clearance
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Clearance record not found"
            });
        }


        return res.json({
            success: true,
            message:
                "Clearance record deleted successfully"
        });

    } catch (error) {
        console.error(
            "Delete clearance record error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Failed to delete clearance record",
            error: error.message
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getClearanceRecords,
    getClearanceRecordById,
    createClearanceRecord,
    updateClearanceRecord,
    deleteClearanceRecord,
    approveClearanceRecord,

    getStudentClearanceEligibility,
    getStudentClearanceEligibilityController,
    syncClearanceStatusForStudent,

    getMyClearanceEligibility,
    getMyClearanceRecords
};
