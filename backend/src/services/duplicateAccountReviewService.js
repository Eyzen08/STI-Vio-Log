const SOURCE_LABELS = {
  USER: 'Active account', STUDENT: 'Student record', STAFF: 'Staff profile', DEPARTMENT_HEAD: 'Department officer',
  GOOGLE_LINK: 'Active Google link'
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
      pool.query(`SELECT s.student_number AS match_key,'STUDENT' source,s.id record_id,s.student_number display FROM students s
        JOIN users u ON u.id=s.user_id AND u.is_active=TRUE`),
      pool.query(`SELECT sp.employee_number AS match_key,'STAFF' source,sp.id record_id,CONCAT(sp.first_name,' ',sp.last_name) display FROM staff_profiles sp
        JOIN users u ON u.id=sp.user_id AND u.is_active=TRUE WHERE sp.employee_number IS NOT NULL
        UNION ALL SELECT dh.employee_number,'DEPARTMENT_HEAD',dh.id,CONCAT(dh.first_name,' ',dh.last_name) FROM department_heads dh
        JOIN users u ON u.id=dh.user_id AND u.is_active=TRUE WHERE dh.employee_number IS NOT NULL`),
      pool.query(`SELECT username AS match_key,'USER' source,id record_id,username display FROM users WHERE is_active=TRUE`),
      pool.query(`SELECT gil.google_subject AS match_key,'GOOGLE_LINK' source,gil.id record_id,'Linked account' display FROM google_identity_links gil
        JOIN users u ON u.id=gil.user_id AND u.is_active=TRUE WHERE gil.revoked_at IS NULL`)
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
