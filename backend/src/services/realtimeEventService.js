const pool = require('../config/database');
const { emitToDepartment, emitToRole, emitToUser } = require('../realtime');

const emitAttendanceChange = async (result, departmentId) => {
  try {
    const payload = {
      assignment_id: Number(result.assignment.id),
      action: result.session.time_out ? 'TIME_OUT' : 'TIME_IN'
    };
    emitToDepartment(departmentId, 'community-service:changed', payload);
    emitToRole('ADMIN', 'community-service:changed', payload);
    emitToRole('DISCIPLINE_OFFICE', 'community-service:changed', payload);
    const student = (await pool.query('SELECT user_id FROM students WHERE id=$1', [result.assignment.student_id])).rows[0];
    if (student?.user_id) emitToUser(student.user_id, 'community-service:changed', payload);
  } catch (error) {
    console.error('Realtime attendance notification failed:', error.message);
  }
};

module.exports = { emitAttendanceChange };
