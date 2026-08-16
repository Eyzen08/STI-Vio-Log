const pool = require("../config/database");

const scanQrCode = async (req, res) => {
    try {
        const { qr_code, scanned_by, department_id } = req.body;

        if (!qr_code || !scanned_by || !department_id) {
            return res.status(400).json({
                success: false,
                message: "qr_code, scanned_by, and department_id are required"
            });
        }

        const studentResult = await pool.query(
            `SELECT * FROM students WHERE qr_code = $1`,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found for this QR code"
            });
        }

        const student = studentResult.rows[0];

        return res.json({
            success: true,
            message: "QR code scanned successfully",
            student: {
                id: student.id,
                student_number: student.student_number,
                first_name: student.first_name,
                last_name: student.last_name,
                qr_code: student.qr_code
            }
        });

    } catch (error) {
        console.error("Scan QR code error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to scan QR code",
            error: error.message
        });
    }
};


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
                message: "qr_code, scanned_by, and department_id are required"
            });
        }

        // Find student using QR code
        const studentResult = await pool.query(
            `SELECT *
             FROM students
             WHERE qr_code = $1`,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = studentResult.rows[0];

        // Record TIME_IN in qr_scan_logs
        const result = await pool.query(
            `INSERT INTO qr_scan_logs (
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
            RETURNING *`,
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
            message: "Time-in recorded successfully",
            studentId: student.id,
            scanLog: result.rows[0]
        });

    } catch (error) {
        console.error("Time-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to record time-in",
            error: error.message
        });
    }
};


const timeOut = async (req, res) => {
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
                message: "qr_code, scanned_by, and department_id are required"
            });
        }

        // Find student using QR code
        const studentResult = await pool.query(
            `SELECT *
             FROM students
             WHERE qr_code = $1`,
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const student = studentResult.rows[0];

        // Record TIME_OUT in qr_scan_logs
        const result = await pool.query(
            `INSERT INTO qr_scan_logs (
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
            RETURNING *`,
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
            message: "Time-out recorded successfully",
            studentId: student.id,
            scanLog: result.rows[0]
        });

    } catch (error) {
        console.error("Time-out error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to record time-out",
            error: error.message
        });
    }
};


module.exports = {
    scanQrCode,
    timeIn,
    timeOut
};