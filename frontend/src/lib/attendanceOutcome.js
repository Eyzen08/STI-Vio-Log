const ATTENDANCE_OUTCOME_LABELS = {
  TODAYS_SERVICE_COMPLETED: "Today’s Service Completed",
  LEFT_EARLY: 'Left Early',
  SERVICE_COMPLETED: 'Service Completed',
  SATISFACTORY: 'Satisfactory',
  NEEDS_FOLLOW_UP: 'Needs Action',
  INCIDENT_REPORTED: 'Reported'
}

export const attendanceOutcomeLabel = (value, fallback = '—') =>
  ATTENDANCE_OUTCOME_LABELS[String(value || '').toUpperCase()] || fallback

