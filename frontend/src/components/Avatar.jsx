import { useState } from 'react'
import { avatarImageUrl } from '../lib/avatar.js'
import { avatarInitials } from '../lib/avatarInitials.js'

export default function Avatar({ identity = {}, avatar = identity?.avatar, className = '', ...props }) {
  const [failedUrl, setFailedUrl] = useState('')
  const url = avatarImageUrl(avatar)
  const name = identity.full_name || identity.name || identity.student_name || ''
  const words = name.trim().split(/\s+/)
  const initials = avatarInitials({ ...identity, ...(name && !identity.first_name ? { first_name: words[0], last_name: words.at(-1) } : {}) })
  return <span className={`portal-avatar ${className}`.trim()} aria-hidden="true" {...props}>
    {url && url !== failedUrl ? <img src={url} alt="" onError={() => setFailedUrl(url)} /> : initials}
  </span>
}
