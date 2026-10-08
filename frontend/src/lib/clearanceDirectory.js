export function filterClearanceStudents(students, search, status) {
  const query = search.trim().toLowerCase()
  return students.filter((student) => (status === 'ALL' || student.qualification_status === status)
    && (!query || [student.student_name, student.student_number, student.program, student.strand].some((value) => String(value || '').toLowerCase().includes(query))))
}

export function clearanceStatusLabel(student) {
  if (student.qualification_status === 'QUALIFIED') return student.has_issued_certificate ? 'Certificate issued' : 'Ready for certificate'
  return {
    AWAITING_CLEARANCE: 'Awaiting clearance',
    NEEDS_SERVICE: 'Needs service hours',
    BLOCKED: 'Blocked by violation',
    NO_SERVICE_REQUIRED: 'No service assigned',
  }[student.qualification_status] || 'Status unavailable'
}
