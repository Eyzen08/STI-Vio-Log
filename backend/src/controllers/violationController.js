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
const { recalculateOffenseStatus } = require("../services/offenseEscalationService");
const { assertAllowedFields, isPositiveId, parsePagination } = require("../utils/validators");

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    && !Number.isNaN(new Date(`${value}T00:00:00+08:00`).getTime());
const isTimeOfDay = (value) => value === null || value === undefined || value === ''
    || /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value));


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
            SELECT v.*, substring(v.description from '^Handbook offense: ([^\n]*)') AS exact_offense, vt.violation_code, vt.violation_name, vt.severity,
                s.student_number,
                CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name, s.suffix) AS student_name,
                ose.indicator_level AS offense_indicator_level,
                ose.minor_count, ose.major_count, ose.grave_count,
                ose.major_level_review_required
            FROM violations v
            JOIN violation_types vt ON vt.id = v.violation_type_id
            JOIN students s ON s.id = v.student_id
            LEFT JOIN student_offense_escalations ose ON ose.student_id = v.student_id
            ORDER BY v.incident_date DESC, v.id DESC
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
            SELECT v.*, substring(v.description from '^Handbook offense: ([^\n]*)') AS exact_offense, vt.violation_code, vt.violation_name, vt.severity,
                s.student_number,
                CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name, s.suffix) AS student_name,
                ose.indicator_level AS offense_indicator_level,
                ose.minor_count, ose.major_count, ose.grave_count,
                ose.major_level_review_required
            FROM violations v
            JOIN violation_types vt ON vt.id = v.violation_type_id
            JOIN students s ON s.id = v.student_id
            LEFT JOIN student_offense_escalations ose ON ose.student_id = v.student_id
            WHERE v.id = $1
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
        assertAllowedFields(req.body, ["student_id", "violation_type_id", "incident_date", "incident_time", "description"]);
        const {
            student_id,
            violation_type_id,
            incident_date,
            incident_time,
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

        if (!isIsoDate(incident_date) || !isTimeOfDay(incident_time)) {
            return res.status(400).json({ success: false, message: "Enter a valid incident date and time" });
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
                incident_time,
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
                $9,
                $10
            )
            RETURNING *
            `,
            [
                student_id,
                violation_type_id,
                req.user.id,
                incident_date,
                incident_time || null,
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
        const offenseStatus = await recalculateOffenseStatus({
            client, studentId: violation.student_id, actor: req.user, ipAddress: req.ip
        });

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
            clearanceSync,
            offenseStatus
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
        await client.query('BEGIN');
        const result = await require('../services/violationEditService').editViolationWithClient({
            client, violationId: req.params.id, body: req.body, actor: req.user, ipAddress: req.ip
        });
        await client.query('COMMIT');
        if (result.assignment) await require('../services/realtimeEventService').emitCommunityServiceChange({
            assignmentId: result.assignment.id, studentId: result.violation.student_id,
            departmentId: result.assignment.department_id, action: 'VIOLATION_UPDATED'
        });
        return res.json({ success: true, ...result });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        if (!error.statusCode) console.error('Update violation error:', error);
        return res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ success: false, message: error.statusCode ? error.message : error.code === '23505' ? 'A service assignment was created concurrently. Refresh the case and try again.' : 'Failed to update violation' });
    } finally { client.release(); }
};

const getStudentViolationHistory = async (req, res) => {
    try {
        assertAllowedFields(req.query, ["page", "limit"]);
        const studentId = Number(req.params.studentId);
        if (!isPositiveId(studentId)) return res.status(400).json({ success: false, message: "studentId must be a positive ID" });
        const { page, limit, offset } = parsePagination(req.query);
        const [records, count, summaryResult, categoryResult, escalationResult] = await Promise.all([
            pool.query(`
                SELECT v.*, substring(v.description from '^Handbook offense: ([^\n]*)') AS exact_offense, vt.violation_code, vt.violation_name, vt.severity
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
                WHERE v.student_id = $1 AND v.status <> 'INVALID_CANCEL' AND vt.violation_code LIKE 'HANDBOOK_%'
                GROUP BY vt.violation_code, vt.violation_name
                ORDER BY vt.violation_code`, [studentId]),
            pool.query('SELECT * FROM student_offense_escalations WHERE student_id = $1', [studentId])
        ]);
        const total = count.rows[0]?.total || 0;
        const aggregate = summaryResult.rows[0] || {};
        return res.json({ success: true, violations: records.rows, summary: { total, open: aggregate.open || 0, resolved: aggregate.resolved || 0, requiredHours: Number(aggregate.required_hours || 0), remainingHours: Number(aggregate.remaining_hours || 0), condition: Number(aggregate.open || 0) > 0 ? 'Requires action' : total > 0 ? 'Resolved - monitor' : 'Good standing', categoryCounts: categoryResult.rows.map((row) => ({ code: row.violation_code, name: row.violation_name, count: row.offense_count })), offenseStatus: escalationResult.rows[0] || null }, pagination: { page, limit, total, returned: records.rows.length, hasMore: offset + records.rows.length < total } });
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

        if (result.assignment) await require('../services/realtimeEventService').emitCommunityServiceChange({
            assignmentId: result.assignment.id, studentId: result.violation.student_id,
            departmentId: result.assignment.department_id, action: req.body.action
        });

        return res.json({
            success: true,
            violation: result.violation,
            assignment: result.assignment,
            history: result.history,
            clearanceSync: result.clearanceSync,
            offenseStatus: result.offenseStatus
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

        const corrections = await pool.query(
            `SELECT c.* FROM community_service_hour_corrections c
             JOIN community_service_assignments a ON a.id = c.assignment_id
             WHERE a.violation_id = $1 ORDER BY c.created_at, c.id`, [req.params.id]
        );

        return res.json({
            success: true,
            actions: result.rows,
            hourCorrections: corrections.rows
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
