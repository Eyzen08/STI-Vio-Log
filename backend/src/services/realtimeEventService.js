const pool = require('../config/database');
const { emitToDepartment, emitToRole, emitToUser } = require('../realtime');

const emitCommunityServiceChange = async ({ assignmentId, studentId, departmentId, action }) => {
  try {
    const payload = {
      assignment_id: Number(assignmentId),
      action
    };
    emitToDepartment(departmentId, 'community-service:changed', payload);
    emitToRole('DISCIPLINE_ADMIN', 'community-service:changed', payload);
    emitToRole('DISCIPLINE_OFFICE', 'community-service:changed', payload);
    emitToRole('DISCIPLINE_ADMIN', 'notifications:changed', payload);
    emitToRole('DISCIPLINE_OFFICE', 'notifications:changed', payload);
    const student = studentId
      ? (await pool.query('SELECT user_id FROM students WHERE id=$1', [studentId])).rows[0]
      : (await pool.query('SELECT s.user_id FROM community_service_assignments a JOIN students s ON s.id=a.student_id WHERE a.id=$1', [assignmentId])).rows[0];
    if (student?.user_id) emitToUser(student.user_id, 'community-service:changed', payload);
  } catch (error) {
    console.error('Realtime attendance notification failed:', error.message);
  }
};

const emitAttendanceChange = (result, departmentId) => emitCommunityServiceChange({
  assignmentId: result.assignment.id,
  studentId: result.assignment.student_id,
  departmentId,
  action: result.session.time_out ? 'TIME_OUT' : 'TIME_IN'
});

const emitNotificationChange = (departmentId, payload = {}) => {
  emitToRole('DISCIPLINE_ADMIN', 'notifications:changed', payload);
  emitToRole('DISCIPLINE_OFFICE', 'notifications:changed', payload);
  if (departmentId) emitToDepartment(departmentId, 'notifications:changed', payload);
};

module.exports = { emitAttendanceChange, emitCommunityServiceChange, emitNotificationChange };
