const pool = require("../config/database");
const { notifyStudent } = require('../services/notificationService');
const {
    syncClearanceStatusForStudent
} = require("./clearanceController");
const {
    ViolationWorkflowError,
    insertViolationAction,
    insertViolationAudit,
    transitionViolation
} = require("../services/violationWorkflowService");
const { assertAllowedFields, isPositiveId, parsePagination } = require("../utils/validators");


// =====================================================
// GET ALL VIOLATIONS
// =====================================================

const getViolationTypes = async (req, res) => {
    try {
        assertAllowedFields(req.query, []);
        const result = await pool.query(`
            SELECT id, violation_code, violation_name, description, severity, default_service_hours
            FROM violation_types
            WHERE is_active = TRUE
            ORDER BY CASE violation_code
                WHEN 'HANDBOOK_MINOR' THEN 1
                WHEN 'HANDBOOK_MAJOR_A' THEN 2
                WHEN 'HANDBOOK_MAJOR_B' THEN 3
                WHEN 'HANDBOOK_MAJOR_C' THEN 4
                WHEN 'HANDBOOK_MAJOR_D' THEN 5
                ELSE 6 END,
                violation_name
        `);
        return res.json({ success: true, violationTypes: result.rows });
    } catch (error) {
        console.error("Get violation types error:", error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Failed to get violation types" });
    }
};

const getViolations = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["page", "limit"]);
        const { page, limit, offset } = parsePagination(req.query);
        const result = await pool.query(`
            SELECT *
            FROM violations
            ORDER BY incident_date DESC, id DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return res.json({
            success: true,
            violations: result.rows,
            pagination: { page, limit, returned: result.rows.length }
        });

    } catch (error) {
        console.error(
            "Get violations error:",
            error
        );

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to get violations"
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
// Community service is assigned separately after the violation is recorded.
// =====================================================

const createViolation = async (req, res) => {
    const client = await pool.connect();

    try {
        assertAllowedFields(req.body, ["student_id", "violation_type_id", "incident_date", "description"]);
        const {
            student_id,
            violation_type_id,
            incident_date,
            description,
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
                req.user.id,
                incident_date,
                description || null,
                "OPEN",
                0,
                0,
                null
            ]
        );

        const violation = result.rows[0];

        const assignment = null;

        const history = await insertViolationAction({
            client,
            violationId: violation.id,
            action: "CREATE",
            fromStatus: null,
            toStatus: "OPEN",
            reason: null,
            actor: req.user
        });

        await insertViolationAudit({
            client,
            violationId: violation.id,
            action: "CREATE",
            fromStatus: null,
            toStatus: "OPEN",
            reason: null,
            actor: req.user,
            ipAddress: req.ip
        });

        const clearanceSync = await syncClearanceStatusForStudent(
            violation.student_id,
            client
        );

        await notifyStudent(client, violation.student_id, {
            title: 'New violation recorded',
            message: `Violation #${violation.id} was added to your disciplinary record. Review the details in My Violations.`,
            type: 'VIOLATION_CREATED',
            eventKey: `violation:${violation.id}:created`
        });

        // -------------------------------------------------
        // Commit violation + assignment
        // -------------------------------------------------

        await client.query("COMMIT");

        // -------------------------------------------------
        // Return result
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            violation,
            assignment,
            history,
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

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to create violation"
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
    const client = await pool.connect();
    try {
        assertAllowedFields(req.body, ["violation_type_id", "incident_date", "description", "required_service_hours", "reason"]);
        const { id } = req.params;
        const reason = String(req.body.reason || "").trim();
        if (!reason) return res.status(400).json({ success: false, message: "reason is required for an audited violation update" });

        if (req.body.required_service_hours !== undefined) {
            const requiredHours = Number(req.body.required_service_hours);
            if (!Number.isFinite(requiredHours) || requiredHours < 0) {
                return res.status(400).json({
                    success: false,
                    message: "required_service_hours must be a valid non-negative number"
                });
            }
            req.body.required_service_hours = requiredHours;
        }

        const allowedFields = [
            "violation_type_id",
            "incident_date",
            "description",
            "required_service_hours"
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

        await client.query("BEGIN");
        values.push(id);

        const result = await client.query(
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
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        const violation = result.rows[0];

        if (
            req.body.required_service_hours !== undefined &&
            violation.status !== "OPEN"
        ) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Service hours can only be changed while the violation is open"
            });
        }

        // -------------------------------------------------
        // Synchronize community service assignment
        // -------------------------------------------------

        let assignment = null;

        const assignmentResult = await client.query(
            `
            SELECT *
            FROM community_service_assignments
            WHERE violation_id = $1
            FOR UPDATE
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
                    : completedHours > 0
                        ? "IN_PROGRESS"
                        : "OPEN";

            const completedAt =
                remainingHours <= 0
                    ? existingAssignment.completed_at ||
                      new Date()
                    : null;

            const updatedAssignment =
                await client.query(
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
                violation.student_id,
                client
            );

        // -------------------------------------------------
        // Audit log
        // -------------------------------------------------

        await client.query(
            `INSERT INTO audit_logs (
                user_id, action, table_name, record_id, description, ip_address
             ) VALUES ($1, 'UPDATE', 'violations', $2, $3, $4)`,
            [
                req.user.id,
                violation.id,
                JSON.stringify({ actor_role: req.user.role, fields: allowedFields.filter((field) => req.body[field] !== undefined), reason }),
                req.ip || null
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            violation,
            assignment,
            clearanceSync
        });

    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        console.error(
            "Update violation error:",
            error
        );

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to update violation"
        });
    } finally {
        client.release();
    }
};

const getStudentViolationHistory = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["page", "limit"]);
        const studentId = Number(req.params.studentId);
        if (!isPositiveId(studentId)) return res.status(400).json({ success: false, message: "studentId must be a positive ID" });
        const { page, limit, offset } = parsePagination(req.query);
        const [records, count, summaryResult, categoryResult] = await Promise.all([
            pool.query(`
                SELECT v.*, vt.violation_code, vt.violation_name, vt.severity
                FROM violations v
                JOIN violation_types vt ON vt.id = v.violation_type_id
                WHERE v.student_id = $1
                ORDER BY v.incident_date DESC, v.id DESC
                LIMIT $2 OFFSET $3
            `, [studentId, limit, offset]),
            pool.query("SELECT COUNT(*)::int AS total FROM violations WHERE student_id = $1", [studentId]),
            pool.query(`SELECT
                COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
                COUNT(*) FILTER (WHERE status IN ('COMPLETE', 'CLEAR'))::int AS resolved,
                COALESCE(SUM(required_service_hours) FILTER (WHERE status = 'OPEN'), 0) AS required_hours,
                COALESCE(SUM(GREATEST(required_service_hours - completed_service_hours, 0)) FILTER (WHERE status = 'OPEN'), 0) AS remaining_hours
                FROM violations WHERE student_id = $1`, [studentId]),
            pool.query(`SELECT vt.violation_code, vt.violation_name, COUNT(*)::int AS offense_count
                FROM violations v JOIN violation_types vt ON vt.id = v.violation_type_id
                WHERE v.student_id = $1 AND vt.violation_code LIKE 'HANDBOOK_%'
                GROUP BY vt.violation_code, vt.violation_name
                ORDER BY vt.violation_code`, [studentId])
        ]);
        const total = count.rows[0]?.total || 0;
        const aggregate = summaryResult.rows[0] || {};
        return res.json({ success: true, violations: records.rows, summary: { total, open: aggregate.open || 0, resolved: aggregate.resolved || 0, requiredHours: Number(aggregate.required_hours || 0), remainingHours: Number(aggregate.remaining_hours || 0), condition: Number(aggregate.open || 0) > 0 ? 'Requires action' : total > 0 ? 'Resolved - monitor' : 'Good standing', categoryCounts: categoryResult.rows.map((row) => ({ code: row.violation_code, name: row.violation_name, count: row.offense_count })) }, pagination: { page, limit, total, returned: records.rows.length, hasMore: offset + records.rows.length < total } });
    } catch (error) {
        console.error("Get student violation history error:", error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Failed to get student violation history" });
    }
};


// =====================================================
// DELETE VIOLATION
// =====================================================

const deleteViolation = async (req, res) => {
    return res.status(400).json({
        success: false,
        message: "Violations are retained as disciplinary history and cannot be permanently deleted through this API"
    });
};

const performViolationAction = async (req, res) => {
    try {
        assertAllowedFields(req.body, ["action", "reason"]);
        const result = await transitionViolation({
            pool,
            violationId: req.params.id,
            action: req.body.action,
            reason: req.body.reason,
            actor: req.user,
            ipAddress: req.ip
        });

        return res.json({
            success: true,
            violation: result.violation,
            assignment: result.assignment,
            history: result.history,
            clearanceSync: result.clearanceSync
        });
    } catch (error) {
        if (error instanceof ViolationWorkflowError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
                error: { code: error.code, message: error.message }
            });
        }

        console.error("Violation action error:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Failed to perform violation action",
            ...(error.code ? { error: { code: error.code, message: error.message } } : {})
        });
    }
};

const getViolationActions = async (req, res) => {
    try {
        const violationResult = await pool.query(
            "SELECT id FROM violations WHERE id = $1",
            [req.params.id]
        );

        if (violationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Violation not found"
            });
        }

        const result = await pool.query(
            `SELECT
                id, violation_id, action, from_status, to_status, reason,
                performed_by_user_id, performed_by_role, created_at
             FROM violation_actions
             WHERE violation_id = $1
             ORDER BY created_at ASC, id ASC`,
            [req.params.id]
        );

        return res.json({
            success: true,
            actions: result.rows
        });
    } catch (error) {
        console.error("Get violation actions error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get violation action history"
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getViolationTypes,
    getStudentViolationHistory,
    getViolations,
    getViolationById,
    createViolation,
    updateViolation,
    deleteViolation,
    performViolationAction,
    getViolationActions
};
