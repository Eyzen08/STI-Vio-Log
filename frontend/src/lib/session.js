const TOKEN_KEY = 'sti_vio_log_token'
const USER_KEY = 'sti_vio_log_user'

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized))
  } catch {
    return null
  }
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const loadSession = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  const storedUser = localStorage.getItem(USER_KEY)

  if (!token || !storedUser) {
    clearSession()
    return { token: '', user: null }
  }

  try {
    const user = JSON.parse(storedUser)
    const payload = decodeJwtPayload(token)
    const isExpired = !payload?.exp || payload.exp * 1000 <= Date.now()
    const identityMismatch =
      Number(payload?.id) !== Number(user?.id) ||
      payload?.role !== user?.role ||
      payload?.username !== user?.username ||
      Boolean(payload?.password_change_required) !== Boolean(user?.password_change_required)

    if (isExpired || identityMismatch) throw new Error('Invalid session')

    return { token, user }
  } catch {
    clearSession()
    return { token: '', user: null }
  }
}

export const saveSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
