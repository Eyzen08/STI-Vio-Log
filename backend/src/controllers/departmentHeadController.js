const pool = require("../config/database");

const getDepartmentHeads = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM department_heads
            ORDER BY last_name ASC, first_name ASC
        `);

        res.json({
            success: true,
            departmentHeads: result.rows
        });
    } catch (error) {
        console.error("Get department heads error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get department heads"
        });
    }
};

const getDepartmentHeadById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM department_heads WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department head not found"
            });
        }

        return res.json({
            success: true,
            departmentHead: result.rows[0]
        });
    } catch (error) {
        console.error("Get department head by id error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get department head"
        });
    }
};

const createDepartmentHead = async (req, res) => {
    try {
        const {
            user_id,
            department_id,
            employee_number,
            first_name,
            last_name,
            email,
            qr_scanner_enabled
        } = req.body;

        if (!user_id || !department_id || !first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message: "user_id, department_id, first_name, and last_name are required"
            });
        }

        const result = await pool.query(
            `
                INSERT INTO department_heads (
                    user_id,
                    department_id,
                    employee_number,
                    first_name,
                    last_name,
                    email,
                    qr_scanner_enabled
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `,
            [
                user_id,
                department_id,
                employee_number || null,
                first_name,
                last_name,
                email || null,
                qr_scanner_enabled !== undefined ? qr_scanner_enabled : true
            ]
        );

        return res.status(201).json({
            success: true,
            departmentHead: result.rows[0]
        });
    } catch (error) {
        console.error("Create department head error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create department head"
        });
    }
};

const updateDepartmentHead = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            user_id,
            department_id,
            employee_number,
            first_name,
            last_name,
            email,
            qr_scanner_enabled
        } = req.body;

        const values = [user_id, department_id, employee_number, first_name, last_name, email, qr_scanner_enabled];
        if (values.every((value) => value === undefined)) {
            return res.status(400).json({
                success: false,
                message: "No department head fields provided for update"
            });
        }

        const result = await pool.query(
            `UPDATE department_heads SET
                user_id = CASE WHEN $1 THEN $2 ELSE user_id END,
                department_id = CASE WHEN $3 THEN $4 ELSE department_id END,
                employee_number = CASE WHEN $5 THEN $6 ELSE employee_number END,
                first_name = CASE WHEN $7 THEN $8 ELSE first_name END,
                last_name = CASE WHEN $9 THEN $10 ELSE last_name END,
                email = CASE WHEN $11 THEN $12 ELSE email END,
                qr_scanner_enabled = CASE WHEN $13 THEN $14 ELSE qr_scanner_enabled END
             WHERE id = $15 RETURNING *`,
            [...values.flatMap((value) => [value !== undefined, value]), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department head not found"
            });
        }

        return res.json({
            success: true,
            departmentHead: result.rows[0]
        });
    } catch (error) {
        console.error("Update department head error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update department head"
        });
    }
};

const deleteDepartmentHead = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM department_heads WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department head not found"
            });
        }

        return res.json({
            success: true,
            message: "Department head deleted successfully"
        });
    } catch (error) {
        console.error("Delete department head error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete department head"
        });
    }
};

module.exports = {
    getDepartmentHeads,
    getDepartmentHeadById,
    createDepartmentHead,
    updateDepartmentHead,
    deleteDepartmentHead
};
