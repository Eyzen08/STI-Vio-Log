const SOURCE_LABELS = {
  USER: 'Active account', STUDENT: 'Student record', STAFF: 'Staff profile', DEPARTMENT_HEAD: 'Department officer',
  STUDENT_REGISTRATION: 'Pending student registration', DEPARTMENT_REGISTRATION: 'Pending department registration', GOOGLE_LINK: 'Active Google link'
};

const groupCandidates = (rows, type, { hidden = false } = {}) => {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row.match_key || '').trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ source: row.source, source_label: SOURCE_LABELS[row.source] || row.source, record_id: Number(row.record_id), display: row.display || SOURCE_LABELS[row.source] || row.source });
  }
  return [...groups.entries()].filter(([, sources]) => sources.length > 1).map(([key, sources], index) => ({
    id: `${type}-${index + 1}`, type, identifier: hidden ? 'Hidden Google identity' : key, occurrences: sources.length, sources
  }));
};

const createDuplicateAccountReviewService = ({ pool } = {}) => {
  if (!pool?.query) throw new TypeError('Duplicate review dependencies are required');
  const list = async () => {
    const [studentNumbers, employeeNumbers, usernames, googleIdentities] = await Promise.all([
      pool.query(`SELECT student_number AS match_key,'STUDENT' source,id record_id,student_number display FROM students
        UNION ALL SELECT student_number,'STUDENT_REGISTRATION',id,student_number FROM google_student_registrations WHERE status='PENDING'`),
      pool.query(`SELECT employee_number AS match_key,'STAFF' source,id record_id,CONCAT(first_name,' ',last_name) display FROM staff_profiles WHERE employee_number IS NOT NULL
        UNION ALL SELECT employee_number,'DEPARTMENT_HEAD',id,CONCAT(first_name,' ',last_name) FROM department_heads WHERE employee_number IS NOT NULL
        UNION ALL SELECT employee_number,'DEPARTMENT_REGISTRATION',id,CONCAT(officer_first_name,' ',officer_last_name) FROM google_department_registrations WHERE status='PENDING' AND employee_number IS NOT NULL`),
      pool.query(`SELECT username AS match_key,'USER' source,id record_id,username display FROM users
        UNION ALL SELECT student_number,'STUDENT_REGISTRATION',id,student_number FROM google_student_registrations WHERE status='PENDING'
        UNION ALL SELECT COALESCE(employee_number,CONCAT('department-',id)),'DEPARTMENT_REGISTRATION',id,CONCAT(officer_first_name,' ',officer_last_name) FROM google_department_registrations WHERE status='PENDING'`),
      pool.query(`SELECT google_subject AS match_key,'GOOGLE_LINK' source,id record_id,'Linked account' display FROM google_identity_links WHERE revoked_at IS NULL
        UNION ALL SELECT google_subject,'STUDENT_REGISTRATION',id,'Pending student request' FROM google_student_registrations WHERE status='PENDING'
        UNION ALL SELECT google_subject,'DEPARTMENT_REGISTRATION',id,'Pending department request' FROM google_department_registrations WHERE status='PENDING'`)
    ]);
    const conflicts = [
      ...groupCandidates(studentNumbers.rows, 'STUDENT_NUMBER'),
      ...groupCandidates(employeeNumbers.rows, 'EMPLOYEE_NUMBER'),
      ...groupCandidates(usernames.rows, 'USERNAME'),
      ...groupCandidates(googleIdentities.rows, 'GOOGLE_IDENTITY', { hidden: true })
    ];
    return { conflicts, summary: { total: conflicts.length, student_number: conflicts.filter((item) => item.type === 'STUDENT_NUMBER').length, employee_number: conflicts.filter((item) => item.type === 'EMPLOYEE_NUMBER').length, username: conflicts.filter((item) => item.type === 'USERNAME').length, google_identity: conflicts.filter((item) => item.type === 'GOOGLE_IDENTITY').length } };
  };
  return { list };
};

module.exports = { createDuplicateAccountReviewService, groupCandidates };
