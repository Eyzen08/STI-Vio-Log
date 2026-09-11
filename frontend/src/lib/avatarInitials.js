const normalized = (value) => String(value ?? '').normalize('NFKC').trim()

export function avatarInitials(identity = {}) {
  const firstName = normalized(identity.first_name)
  const lastName = normalized(identity.last_name)

  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()

  const username = normalized(identity.username)
  return username.slice(0, 2).toUpperCase() || 'U'
}

