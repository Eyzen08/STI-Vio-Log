const validateServiceDestination = async (client, departmentId, headId) => {
    const destination = (await client.query(
        `SELECT dh.id, dh.user_id, d.department_code, d.department_name, dh.first_name, dh.last_name
         FROM department_heads dh
         JOIN users u ON u.id = dh.user_id AND u.role = 'DEPARTMENT_HEAD' AND u.is_active = TRUE
         JOIN departments d ON d.id = dh.department_id AND d.is_active = TRUE
         WHERE d.id = $1 AND dh.id = $2
         FOR SHARE OF dh, u, d`,
        [departmentId, headId]
    )).rows[0];
    if (!destination) {
        const error = new Error('Select an active Department Head assigned to the chosen department');
        error.statusCode = 400;
        throw error;
    }
    return destination;
};

module.exports = { validateServiceDestination };
