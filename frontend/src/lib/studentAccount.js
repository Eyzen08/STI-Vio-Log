export const normalizeStudentGmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : ''

export const isValidStudentGmail = (email) => {
  const normalized = normalizeStudentGmail(email)
  return normalized.length <= 255 && /^[^\s@]+@gmail\.com$/.test(normalized)
}

export const sendStudentCredentialsEmail = async ({ apiUrl, token, studentId, password, fetchImpl = globalThis.fetch }) => {
  const response = await fetchImpl(`${apiUrl}/api/students/${studentId}/credentials-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ temporary_password: password })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.message || 'Email could not be sent. Retry or copy the credentials for manual sharing.')
  return data
}
