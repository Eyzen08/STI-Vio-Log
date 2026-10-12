export function filterClearanceStudents(students, search, status) {
  const query = search.trim().toLowerCase()
  return students.filter((student) => (status === 'ALL' || student.qualification_status === status)
    && (!query || [student.student_name, student.student_number, student.program, student.strand].some((value) => String(value || '').toLowerCase().includes(query))))
}

export function clearanceStatusLabel(student) {
  if (student.qualification_status === 'QUALIFIED') return student.has_issued_certificate ? 'Certificate Issued' : 'Ready for Certificate'
  return {
    AWAITING_CLEARANCE: 'Awaiting Clearance',
    NEEDS_SERVICE: 'Needs Service Hours',
    BLOCKED: 'Blocked by Violation',
    NO_SERVICE_REQUIRED: 'No Service Assigned',
  }[student.qualification_status] || 'Status Unavailable'
}
