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

        const fields = [
            user_id !== undefined ? "user_id = $1" : null,
            department_id !== undefined ? "department_id = $2" : null,
            employee_number !== undefined ? "employee_number = $3" : null,
            first_name !== undefined ? "first_name = $4" : null,
            last_name !== undefined ? "last_name = $5" : null,
            email !== undefined ? "email = $6" : null,
            qr_scanner_enabled !== undefined ? "qr_scanner_enabled = $7" : null
        ].filter(Boolean);

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No department head fields provided for update"
            });
        }

        const values = [
            user_id,
            department_id,
            employee_number,
            first_name,
            last_name,
            email,
            qr_scanner_enabled,
            id
        ].filter((value, index) => {
            const provided = [
                user_id !== undefined,
                department_id !== undefined,
                employee_number !== undefined,
                first_name !== undefined,
                last_name !== undefined,
                email !== undefined,
                qr_scanner_enabled !== undefined
            ];
            return provided[index];
        }).concat(id);

        const result = await pool.query(
            `UPDATE department_heads SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
            values
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
