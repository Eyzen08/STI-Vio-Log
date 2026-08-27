export const getStudentQrPayload = (profile) => {
  const value = profile?.qr_code
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const qrDownloadName = (studentNumber) => {
  const safeNumber = String(studentNumber || 'student').replace(/[^a-z0-9_-]/gi, '') || 'student'
  return `sti-vio-log-${safeNumber}-qr.png`
}
